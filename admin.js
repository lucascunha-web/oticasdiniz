import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, collection, doc, getDoc, getDocs, updateDoc, setDoc, collectionGroup, addDoc, deleteDoc, writeBatch, query, where, FieldPath } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwE1WFYWOHBZPXhapa-td7NxA3Ndx-P2w",
  authDomain: "diniz-5e4af.firebaseapp.com",
  projectId: "diniz-5e4af",
  storageBucket: "diniz-5e4af.firebasestorage.app",
  messagingSenderId: "473285890866",
  appId: "1:473285890866:web:3715d02b32fac942a37d2b",
  measurementId: "G-4HBMBK0GWD"
};

// Evita erro de inicialização duplicada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializa o Firestore com o novo sistema de cache (evita erros de "already started")
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
} catch (e) {
  db = getFirestore(app);
}

const monthKey = (() => {
  const now = new Date();
  // Se for o primeiro dia do mês, ainda exibe/edita os dados do mês anterior
  if (now.getDate() === 1) {
    now.setMonth(now.getMonth() - 1);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();

let currentView = "lojas"; // Estado da aba atual
let showInactiveSellers = false; // Estado para visualização de vendedores inativos

// Função de normalização para bater com o painel
const normalize = (val) => String(val || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const role = sessionStorage.getItem("usuarioCargo") || "";
const normalizedRole = normalize(role);

// Se o gerente também precisar ver esse botão, adicione 'gerente' na lista abaixo
const isAdmin = ["admin", "administrador"].includes(normalizedRole);

if (isAdmin) {
  const btn = document.getElementById("adminButton");
  btn.style.display = "grid";
  btn.addEventListener("click", openAdminModal);

  document.getElementById("btnViewLojas").addEventListener("click", () => switchAdminView("lojas"));
  document.getElementById("btnViewVendedores").addEventListener("click", () => switchAdminView("vendedores"));
  document.getElementById("btnViewUsuarios").addEventListener("click", () => switchAdminView("usuarios"));
  document.getElementById("btnViewTabelas").addEventListener("click", () => switchAdminView("tabelas"));
  document.getElementById("btnViewComunicados").addEventListener("click", () => switchAdminView("comunicados"));
  document.getElementById("btnViewTreinamentos").addEventListener("click", () => switchAdminView("treinamentos"));

  // Detecta alterações nos campos para mudar a cor para amarelo
  document.getElementById("adminTableBody").addEventListener("input", (e) => {
    if (e.target.classList.contains("edit-field")) {
      e.target.classList.add("modified");
    }
  });

  // Listeners para atualizar info de dias
  document.getElementById("calcDiasTrab").addEventListener("input", updateDaysInfo);
  document.getElementById("calcFeriados").addEventListener("input", updateDaysInfo);
  document.getElementById("calcDiasTrab").addEventListener("change", saveGlobalDays);
  document.getElementById("calcFeriados").addEventListener("change", saveGlobalDays);
  document.getElementById("btnSaveNew").addEventListener("click", addNewItem);
  document.getElementById("btnSaveNewLesson").addEventListener("click", addNewLesson);
  document.getElementById("btnSaveNewUser").addEventListener("click", addNewUser);
  document.getElementById("btnSaveNewSeller")?.addEventListener("click", addNewSeller);
  document.getElementById("btnToggleAddSeller")?.addEventListener("click", toggleAddSellerForm);
  document.getElementById("btnSaveAll").addEventListener("click", saveAllModifiedRows);

  document.getElementById("btnToggleInactive").addEventListener("click", () => {
    showInactiveSellers = !showInactiveSellers;
    document.getElementById("btnToggleInactive").textContent = showInactiveSellers ? "Ocultar Inativos" : "Mostrar Inativos";
    loadAdminMatrix();
  });

  // Listener para fechar o modal de histórico de loja
  const closeHistoryBtn = document.getElementById("closeHistoryModal");
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener("click", () => {
      document.getElementById("historyModal").style.display = "none";
      document.body.classList.remove("modal-open");
    });
  }
}

function switchAdminView(view) {
  const modifiedFields = document.querySelectorAll("#adminTableBody .modified");
  if (modifiedFields.length > 0) {
    const confirmSwitch = confirm("Existem alterações não salvas nesta aba. Deseja mudar de aba e perder as modificações?");
    if (!confirmSwitch) return;
  }

  currentView = view;
  document.getElementById("btnViewLojas").classList.toggle("active", view === "lojas");
  document.getElementById("btnViewVendedores").classList.toggle("active", view === "vendedores");
  document.getElementById("btnViewUsuarios").classList.toggle("active", view === "usuarios");
  document.getElementById("btnViewTabelas").classList.toggle("active", view === "tabelas");
  document.getElementById("btnViewComunicados").classList.toggle("active", view === "comunicados");
  document.getElementById("btnViewTreinamentos").classList.toggle("active", view === "treinamentos");

  loadAdminMatrix();
}

function closeAdminModal() {
  const modifiedFields = document.querySelectorAll("#adminTableBody .modified");
  if (modifiedFields.length > 0) {
    const confirmLeave = confirm("Existem campos alterados que não foram salvos. Deseja realmente sair?");
    if (!confirmLeave) return;
  }

  const modal = document.getElementById("adminModal");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("modal-open");
}

document.getElementById("closeAdmin")?.addEventListener("click", closeAdminModal);

// Fecha também ao clicar fora do card (no backdrop escuro)
document.getElementById("adminModal")?.addEventListener("click", (e) => {
  if (e.target.id === "adminModal") {
    closeAdminModal();
  }
});

// Fecha também pressionando a tecla ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("adminModal");
    if (modal && modal.style.display === "flex") {
      closeAdminModal();
    }
  }
});

async function openAdminModal() {
  const modal = document.querySelector("#adminModal");
  if (!modal) return console.error("Modal admin não encontrado no HTML");
  
  modal.style.display = "flex";
  document.body.classList.add("modal-open");

  try {
    // Busca os parâmetros globais diretamente no documento GERAL da coleção lojas
    const geralRef = doc(db, "lojas", "GERAL");
    const geralSnap = await getDoc(geralRef);

    if (geralSnap.exists()) {
      const data = geralSnap.data();
      document.getElementById("calcDiasTrab").value = data.diasTrabalhados !== undefined ? data.diasTrabalhados : "1";
      document.getElementById("calcFeriados").value = data.feriados !== undefined ? data.feriados : "4";
    }
  } catch (e) {
    console.error("Erro ao carregar configurações das lojas do Firestore:", e);
  }

  updateDaysInfo();
  populateStoreDatalist();
  await loadAdminMatrix();
}

async function populateStoreDatalist() {
  const datalist = document.getElementById("storeDatalist");
  if (!datalist || datalist.children.length > 0) return;
  try {
    const snap = await getDocs(collection(db, "lojas"));
    datalist.innerHTML = snap.docs
      .filter(d => d.id !== "GERAL")
      .map(d => `<option value="${d.id}">`)
      .join("");
  } catch (e) {
    console.error("Erro ao carregar lojas para datalist:", e);
  }
}

function updateDaysInfo() {
  const diasTrab = Number(document.getElementById("calcDiasTrab").value) || 0;
  const feriados = Number(document.getElementById("calcFeriados").value) || 0;

  const [year, month] = monthKey.split("-").map(Number);
  // Correctly get total days in the month represented by monthKey
  const totalDays = new Date(year, month , 0).getDate(); 
  const remaining = totalDays - feriados - diasTrab;

  document.getElementById("displayTotalDays").textContent = totalDays;
  document.getElementById("displayRemainingDays").textContent = remaining;
}

async function saveGlobalDays() {
  const diasTrab = Number(document.getElementById("calcDiasTrab").value) || 0;
  const feriados = Number(document.getElementById("calcFeriados").value) || 0;

  try {
    await setDoc(doc(db, "lojas", "GERAL"), {
      diasTrabalhados: diasTrab,
      feriados: feriados
    }, { merge: true });
  } catch (e) {
    console.error("Erro ao salvar configurações globais no Firestore:", e);
  }
}

function formatMonthKey(key) {
  const [year, month] = key.split("-");
  return `${month}/${year}`;
}

async function loadAdminMatrix() {
  const tbody = document.getElementById("adminTableBody");
  const thead = document.querySelector(".admin-matrix thead tr");
  const calcBar = document.querySelector(".admin-calc-bar");
  const addBar = document.getElementById("adminAddForm");
  const addUserBar = document.getElementById("adminAddUserForm");
  const addLessonBar = document.getElementById("adminAddLessonForm");
  const addSellerBar = document.getElementById("adminAddSellerForm");
  const toggleAddSellerBtn = document.getElementById("btnToggleAddSeller");
  const toggleInactiveBtn = document.getElementById("btnToggleInactive");
  
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px;">Buscando dados de ${currentView} (Ref: ${formatMonthKey(monthKey)})...</td></tr>`;
  if (calcBar) calcBar.style.display = (currentView === "lojas" || currentView === "vendedores") ? "flex" : "none";
  if (addUserBar) addUserBar.style.display = currentView === "usuarios" ? "flex" : "none";
  if (toggleInactiveBtn) toggleInactiveBtn.style.display = currentView === "vendedores" ? "block" : "none";
  if (addSellerBar) addSellerBar.style.display = "none";
  if (toggleAddSellerBtn) toggleAddSellerBtn.style.display = currentView === "vendedores" ? "inline-flex" : "none";
  addBar.style.display = currentView === "comunicados" ? "flex" : "none";
  if (addLessonBar) addLessonBar.style.display = currentView === "treinamentos" ? "flex" : "none";

  // Atualiza labels do formulário de adição baseado na aba ativa
  const lblTitle = document.getElementById("lblNewTitle");
  const lblURL = document.getElementById("lblNewURL");
  if (lblTitle && lblURL && currentView === "comunicados") {
    lblTitle.textContent = "Título do Comunicado";
    lblURL.textContent = "Link do Comunicado (URL)";
  }

  // Define o cabeçalho dinamicamente
  if (currentView === "lojas") {
    thead.innerHTML = `
      <th style="width:120px">Loja</th><th style="width:120px">Faturamento</th><th style="width:100px">Vendas</th><th style="width:120px">T. Médio</th>
      <th style="width:100px">Desc %</th><th style="width:100px">MKP</th><th>Meta Com.</th><th>Meta Fat.</th><th>Projeção</th><th style="width:100px">Ação</th>
    `;
  } else if (currentView === "vendedores") {
    thead.innerHTML = `
      <th style="width:150px">Vendedor</th>
      <th style="width:200px">Foto Perfil URL</th>
      <th>Faturamento</th>
      <th style="width:100px">Vendas</th>
      <th>T. Médio</th>
      <th>Desc %</th>
      <th>Avaliações</th><th>Meta Com.</th><th>Meta Fat.</th><th>Projeção</th><th>Ação</th>
    `;
  } else if (currentView === "treinamentos") {
    thead.innerHTML = `<th style="width:250px">Módulo (Título)</th><th>Apostila (URL)</th><th style="width:140px">Ação</th>`;
  } else if (currentView === "usuarios") {
    thead.innerHTML = `<th style="width:250px">Módulo (Título)</th><th>Apostila (URL)</th><th style="width:140px">Ação</th>`;
  } else {
    thead.innerHTML = `
      <th style="width:250px">Título / Nome</th><th>Link do Arquivo (URL)</th><th style="width:140px">Ação</th>
    `;
  }

  try {
    if (currentView === "usuarios") {
      thead.innerHTML = `<th>Usuário (Login)</th><th>Loja</th><th>Cargo</th><th>Senha</th><th style="width:100px">Ação</th>`;
      const snapshot = await getDocs(collection(db, "usuarios"));
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      tbody.innerHTML = records.map(u => `
        <tr data-id="${u.id}">
          <td style="font-weight:800; text-transform: uppercase;">${u.id}</td>
          <td><input type="text" class="edit-field" data-key="loja" value="${u.loja || ''}" style="width:100%"></td>
          <td><input type="text" class="edit-field" data-key="cargo" value="${u.cargo || ''}" style="width:100%"></td>
          <td><input type="text" class="edit-field" data-key="senha" value="${u.senha || ''}" style="width:100%"></td>
          <td>
            <div class="admin-btn-group">
              <button class="btn-row-action" style="background:var(--ink); color:#fff" onclick="window.saveAdminRow('${u.id}')" title="Salvar">💾</button>
              <button class="btn-row-action" style="background:var(--red); color:#fff" onclick="window.deleteAdminRow('${u.id}')" title="Excluir">🗑️</button>
            </div>
          </td>
        </tr>
      `).join("");

      if (records.length === 0) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px;">Nenhum usuário encontrado.</td></tr>`;

    } else if (currentView === "tabelas" || currentView === "comunicados" || currentView === "treinamentos") {
      const snapshot = await getDocs(collection(db, currentView));
      const records = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.id.localeCompare(b.id));

      if (currentView === "treinamentos") {
        const select = document.getElementById("newLessonModule");
        if (select) {
          select.innerHTML = records.map(r => `<option value="${r.id}">${r.titulo || r.id}</option>`).join("");
        }
      }

      if (currentView === "treinamentos") {
        tbody.innerHTML = records.map(t => `
          <tr data-id="${t.id}">
            <td style="font-weight:800; text-transform: uppercase; color: var(--ink);">
              <input type="text" class="edit-field" data-key="titulo" value="${t.titulo || t.id}" style="width:100%">
            </td>
            <td><input type="text" class="edit-field" data-key="apostila" id="url-${t.id}" value="${t.apostila || ''}" style="width:100%"></td>
            <td>
              <div class="admin-btn-group">
                <button class="btn-row-action" style="background:var(--bg-muted); color:var(--ink)" onclick="window.toggleLessons('${t.id}')" title="Ver Aulas">📖</button>
                <button class="btn-row-action" style="background:var(--ink); color:#fff" onclick="window.saveAdminRow('${t.id}')" title="Salvar">💾</button>
                <button class="btn-row-action" style="background:var(--red); color:#fff" onclick="window.deleteAdminRow('${t.id}')" title="Excluir">🗑️</button>
              </div>
            </td>
          </tr>
          <tr id="lessons-row-${t.id}" style="display:none; background: var(--bg-muted);">
            <td colspan="3">
              <div id="lessons-container-${t.id}" style="padding: 15px; border: 1px solid var(--line); border-radius: 8px; margin: 5px; background: var(--surface);">
                Carregando aulas...
              </div>
            </td>
          </tr>
        `).join("");
      } else {
        tbody.innerHTML = records.map(t => `
          <tr data-id="${t.id}">
            <td style="font-weight:800; text-transform: uppercase; color: var(--ink);">
              <input type="text" class="edit-field" data-key="Titulo" value="${t.Titulo || t.id}" style="width:100%">
            </td>
            <td><input type="text" class="edit-field" data-key="URL" id="url-${t.id}" value="${t.URL || ''}" style="width:100%"></td>
            <td>
              <div class="admin-btn-group">
                <button class="btn-row-action" style="background:var(--bg-muted); color:var(--ink)" onclick="window.openPDF('${t.id}')" title="Visualizar Link">👁️</button>
                <button class="btn-row-action" style="background:var(--ink); color:#fff" onclick="window.saveAdminRow('${t.id}')" title="Salvar">💾</button>
                <button class="btn-row-action" style="background:var(--red); color:#fff" onclick="window.deleteAdminRow('${t.id}')" title="Excluir">🗑️</button>
              </div>
            </td>
          </tr>
        `).join("");
      }
    } else {
      // Busca as métricas e a lista base simultaneamente
      const metricsSnapshot = await getDocs(collectionGroup(db, "metricas"));
      const baseSnapshot = await getDocs(collection(db, currentView));

      const currentMonthMetrics = {};
      const allKnownIds = new Set();

      // 1. Identifica IDs através do histórico de métricas (garante que lojas sem documento pai apareçam)
      metricsSnapshot.docs.forEach(mDoc => {
        if (mDoc.ref.path.startsWith(currentView + "/")) {
          const parentId = mDoc.ref.parent.parent.id;
          allKnownIds.add(parentId);
          if (mDoc.id === monthKey) {
            currentMonthMetrics[parentId] = mDoc.data();
          }
        }
      });

      // 2. Mapeia dados de perfil (fotos, status ativo) dos documentos existentes
      const profilesMap = {};
      baseSnapshot.docs.forEach(docSnap => {
        profilesMap[docSnap.id] = docSnap.data();
        allKnownIds.add(docSnap.id);
      });

      // 3. Constrói a lista final combinando as duas fontes
      const records = Array.from(allKnownIds)
        .map(id => {
          const baseData = profilesMap[id] || {};
          
          // Filtro de vendedores ativos/inativos
          if (currentView === "vendedores" && !showInactiveSellers && baseData.ativo === false) {
            return null;
          }

          const monthData = currentMonthMetrics[id] || {};
          return {
            id,
            ...monthData,
            foto: baseData.foto || "",
            ativo: baseData.ativo !== false
          };
        })
        .filter(r => r !== null);

      const sortedRecords = records.sort((a, b) => {
        if (a.id === "GERAL") return -1;
        if (b.id === "GERAL") return 1;
        return a.id.localeCompare(b.id);
      });

    if (currentView === "lojas") {
      tbody.innerHTML = sortedRecords.map(s => {
        const isGeral = s.id === "GERAL";
        return `
        <tr data-id="${s.id}" class="${isGeral ? 'geral-row' : ''}">
          <td style="font-weight:800;">${s.id}</td>
          <td><input type="number" class="edit-field" data-key="faturamento" value="${s.faturamento || 0}" ${isGeral ? 'readonly' : ''}></td>
          <td><input type="number" class="edit-field" data-key="vendas" value="${s.vendas || 0}" ${isGeral ? 'readonly' : ''}></td>
          <td><input type="number" class="edit-field" data-key="ticketMedio" value="${s.ticketMedio || 0}"></td>
          <td><input type="number" class="edit-field" data-key="desconto" step="0.01" value="${s.desconto || 0}"></td>
          <td><input type="number" class="edit-field" data-key="mkp" step="0.01" value="${s.mkp || 0}"></td>
          <td><input type="number" class="edit-field" data-key="metaComissao" value="${s.metaComissao || 0}" ${isGeral ? 'readonly' : ''}></td>
          <td><input type="number" class="edit-field" data-key="metaFaturamento" value="${s.metaFaturamento || 0}" ${isGeral ? 'readonly' : ''}></td>
          <td><input type="number" class="proj-field" value="${s.projeção || 0}" readonly></td>
          <td><button class="btn-row-action" style="background:var(--ink); color:#fff" onclick="window.saveAdminRow('${s.id}')" title="Salvar">💾</button></td>
        </tr>
      `}).join("");
    } else if (currentView === "vendedores") {
      tbody.innerHTML = sortedRecords.map(v => `
        <tr data-id="${v.id}" style="${v.ativo === false ? 'opacity: 0.5; background-color: #f8f9fa;' : ''}">
          <td style="font-weight:800;">${v.id}</td>
          <td><input type="text" class="edit-field" data-key="foto" value="${v.foto || ''}"></td>
          <td><input type="number" class="edit-field" data-key="faturamento" value="${v.faturamento || 0}"></td>
          <td><input type="number" class="edit-field" data-key="vendas" value="${v.vendas || 0}"></td>
          <td><input type="number" class="edit-field" data-key="ticketMedio" value="${v.ticketMedio || 0}"></td>
          <td><input type="number" class="edit-field" data-key="desconto" value="${v.desconto || 0}"></td>
          <td><input type="number" class="edit-field" data-key="avaliacoes" value="${v.avaliacoes || 0}"></td>
          <td><input type="number" class="edit-field" data-key="metaComissao" value="${v.metaComissao || 0}"></td>
          <td><input type="number" class="edit-field" data-key="metaFaturamento" value="${v.metaFaturamento || 0}"></td>
          <td><input type="number" class="proj-field" value="${v.projeção || 0}" readonly></td>
          <td>
            <div style="display:flex; gap:4px;">
              <button class="btn-row-action" style="background:var(--ink); color:#fff" onclick="window.saveAdminRow('${v.id}')" title="Salvar">💾</button> 
              ${v.ativo !== false ?
                `<button class="btn-row-action" style="background:var(--red); color:#fff" onclick="window.deactivateSeller('${v.id}')" title="Desativar">🚫</button>` :
                `<button class="btn-row-action" style="background:var(--green); color:#fff" onclick="window.reactivateSeller('${v.id}')" title="Reativar">✅</button>`
              }
            </div>
          </td>
        </tr>
      `).join("");
    }
    }

  } catch (e) {
    console.error("Erro ao carregar matriz:", e);
  }
}

window.saveAdminRow = async (id) => {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const inputs = row.querySelectorAll(".edit-field");
  const saveBtn = row.querySelector("button[title='Salvar']");
  const updateData = { atualizadoEm: new Date() };

  inputs.forEach(input => {
    const key = input.dataset.key;
    let val = input.value;

    if (input.type !== "text" && key !== "URL" && key !== "Titulo" && key !== "foto" && key !== "loja" && key !== "cargo" && key !== "senha") {
        val = Number(input.value);
    } else if (input.type === "text") {
        val = input.value.trim();
    }
    updateData[input.dataset.key] = val;
  });

  try {
    if (currentView === "vendedores" && (updateData.hasOwnProperty("foto") || updateData.hasOwnProperty("ativo"))) {
      const sellerDocUpdates = {};
      if (updateData.hasOwnProperty("foto")) { sellerDocUpdates.foto = updateData.foto; delete updateData.foto; }
      if (updateData.hasOwnProperty("ativo")) { sellerDocUpdates.ativo = updateData.ativo; delete updateData.ativo; }
      
      if (Object.keys(sellerDocUpdates).length > 0) {
        await updateDoc(doc(db, "vendedores", id), sellerDocUpdates);
      }
    }

    if (Object.keys(updateData).length > 1) {
      const docRef = (["tabelas", "comunicados", "treinamentos", "usuarios"].includes(currentView))
        ? doc(db, currentView, id)
        : doc(db, currentView, id, "metricas", monthKey);
      await setDoc(docRef, updateData, { merge: true });
    }

    // Feedback Visual de Sucesso
    inputs.forEach(input => input.classList.remove("modified"));
    
    if (saveBtn) {
      saveBtn.classList.add("save-success");
      const originalIcon = saveBtn.textContent;
      saveBtn.textContent = "✅";
      setTimeout(() => {
        saveBtn.classList.remove("save-success");
        saveBtn.textContent = originalIcon;
      }, 2000);
    }
  } catch (e) {
    alert("Erro ao salvar dados: " + e.message);
  }
};

document.getElementById("btnCalcularProjecao").addEventListener("click", async () => {
  const diasTrab = Number(document.getElementById("calcDiasTrab").value);
  const feriados = Number(document.getElementById("calcFeriados").value);
  
  if (diasTrab <= 0) return alert("Dias trabalhados deve ser maior que 0.");

  // Cálculo de dias que faltam: Dias do Mês - Feriados - Dias Trabalhados
  const [year, month] = monthKey.split("-").map(Number);
  // Correctly get total days in the month represented by monthKey
  const totalDaysInMonth = new Date(year, month , 0).getDate();
  const diasFaltam = totalDaysInMonth - feriados - diasTrab;

  const rows = document.querySelectorAll("#adminTableBody tr");
  const batch = writeBatch(db);

  // Salva os parâmetros globais do cálculo na raiz do documento GERAL na coleção lojas
  batch.set(doc(db, "lojas", "GERAL"), { 
    diasTrabalhados: diasTrab, 
    feriados: feriados 
  }, { merge: true });

  for (const row of rows) {
    const storeId = row.dataset.id;
    const fatInput = row.querySelector('[data-key="faturamento"]');
    const projInput = row.querySelector('.proj-field');
    
    const faturado = Number(fatInput.value);
    
    // Formula: (Faturado / Dias Trab) * Dias que faltam + Faturado
    const novaProjecao = Number((faturado / diasTrab * diasFaltam + faturado).toFixed(2));
    
    projInput.value = novaProjecao;
    
    const metricRef = doc(db, currentView, storeId, "metricas", monthKey);
    batch.set(metricRef, { projeção: novaProjecao, atualizadoEm: new Date() }, { merge: true });

    // Se estivermos editando lojas, salva os parâmetros diretamente no documento da loja (raiz da coleção)
    if (currentView === "lojas" && storeId !== "GERAL") {
      batch.set(doc(db, "lojas", storeId), { 
        diasTrabalhados: diasTrab, 
        feriados: feriados 
      }, { merge: true });
    }
  }

  try {
    await batch.commit();
    alert("Projeções calculadas e salvas para todas as lojas!");
  } catch (e) {
    alert("Erro ao salvar projeções.");
  }
});

window.openPDF = (id) => {
  const input = document.getElementById(`url-${id}`);
  const url = input ? input.value.trim() : "";
  if (url) window.open(url, "_blank");
  else alert("URL vazia.");
};

window.deleteAdminRow = async (id) => {
  if (!confirm(`Tem certeza que deseja excluir ${id}?`)) return;
  try {
    await deleteDoc(doc(db, currentView, id));
    alert("Excluído com sucesso.");
    loadAdminMatrix();
  } catch (e) {
    alert("Erro ao excluir.");
  }
};

window.deactivateSeller = async (id) => {
  if (!confirm(`Deseja desativar o vendedor ${id}? Ele não aparecerá mais nos rankings e no admin do mês atual, mas seus dados históricos serão preservados.`)) return;
  try {
    // Usamos setDoc com merge em vez de updateDoc para garantir a criação 
    // do campo mesmo que o documento de perfil base não exista
    await setDoc(doc(db, "vendedores", id), { ativo: false }, { merge: true });
    alert("Vendedor desativado com sucesso.");
    loadAdminMatrix(); // Recarrega a lista para aplicar o filtro
  } catch (e) {
    alert("Erro ao desativar vendedor.");
  }
};

window.reactivateSeller = async (id) => {
  if (!confirm(`Deseja reativar o vendedor ${id}? Ele voltará a aparecer nos rankings.`)) return;
  try {
    await setDoc(doc(db, "vendedores", id), { ativo: true }, { merge: true });
    alert("Vendedor reativado com sucesso.");
    // Mantém na visão de inativos até o usuário trocar
    loadAdminMatrix();
  } catch (e) {
    alert("Erro ao reativar vendedor.");
  }
};

async function addNewItem() {
  const titulo = document.getElementById("newTitle").value.trim();
  const url = document.getElementById("newURL").value.trim();

  if (!titulo || !url) return alert("Preencha título e URL.");

  try {
    if (currentView === "tabelas") {
      await updateDoc(doc(db, "tabelas", titulo.toLowerCase()), { URL: url });
    } else if (currentView === "treinamentos") {
      await addDoc(collection(db, "treinamentos"), { titulo: titulo, apostila: url, criadoEm: new Date() });
    } else {
      await addDoc(collection(db, "comunicados"), { Titulo: titulo, URL: url, criadoEm: new Date() });
    }
    alert("Adicionado com sucesso!");
    document.getElementById("newTitle").value = "";
    document.getElementById("newURL").value = "";
    loadAdminMatrix();
  } catch (e) {
    alert("Erro ao adicionar: " + e.message);
  }
}

async function addNewUser() {
  const login = document.getElementById("newUserName").value.trim().toUpperCase();
  const senha = document.getElementById("newUserPass").value.trim();
  const cargo = document.getElementById("newUserRole").value.trim();
  const loja = document.getElementById("newUserStore").value.trim();

  if (!login || !senha || !cargo) {
    return alert("Preencha Login, Senha e Cargo para adicionar um novo usuário.");
  }

  try {
    await setDoc(doc(db, "usuarios", login), { senha, cargo, loja });
    alert("Usuário adicionado com sucesso!");
    document.getElementById("newUserName").value = "";
    document.getElementById("newUserPass").value = "";
    document.getElementById("newUserRole").value = "";
    document.getElementById("newUserStore").value = "";
    loadAdminMatrix();
  } catch (e) {
    alert("Erro ao adicionar usuário: " + e.message);
  }
}

function toggleAddSellerForm() {
  const bar = document.getElementById("adminAddSellerForm");
  if (!bar) return;
  const isHidden = bar.style.display === "none";
  bar.style.display = isHidden ? "flex" : "none";
  if (isHidden) {
    const input = document.getElementById("newSellerName");
    input?.focus();
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function addNewSeller() {
  const nameInput = document.getElementById("newSellerName");
  const storeInput = document.getElementById("newSellerStore");
  const photoInput = document.getElementById("newSellerPhoto");
  const passInput = document.getElementById("newSellerPass");

  const rawName = nameInput ? nameInput.value.trim() : "";
  if (!rawName) {
    alert("Por favor, preencha o Nome do Vendedor.");
    nameInput?.focus();
    return;
  }

  // Normalização: ID em maiúsculas sem espaços extras
  const sellerId = rawName.toUpperCase();
  const loja = storeInput ? storeInput.value.trim().toUpperCase() : "";
  const foto = photoInput ? photoInput.value.trim() : "";
  const senha = passInput ? passInput.value.trim() : "";

  const btn = document.getElementById("btnSaveNewSeller");
  const originalText = btn ? btn.textContent : "Criar Vendedor ➕";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Criando no DB...";
  }

  try {
    // 1. Cria ou atualiza o perfil base em 'vendedores/{sellerId}'
    await setDoc(doc(db, "vendedores", sellerId), {
      ativo: true,
      foto: foto,
      loja: loja,
      criadoEm: new Date()
    }, { merge: true });

    // 2. Inicializa as métricas do mês vigente em 'vendedores/{sellerId}/metricas/{monthKey}'
    const metricRef = doc(db, "vendedores", sellerId, "metricas", monthKey);
    const existingMetricSnap = await getDoc(metricRef);
    if (!existingMetricSnap.exists()) {
      await setDoc(metricRef, {
        faturamento: 0,
        vendas: 0,
        ticketMedio: 0,
        desconto: 0,
        avaliacoes: 0,
        metaComissao: 0,
        metaFaturamento: 0,
        projeção: 0,
        atualizadoEm: new Date()
      });
    }

    // 3. Se foi informada uma senha, cria também a conta de login em 'usuarios/{sellerId}'
    if (senha) {
      await setDoc(doc(db, "usuarios", sellerId), {
        cargo: "vendedor",
        loja: loja,
        senha: senha,
        criadoEm: new Date()
      }, { merge: true });
    }

    alert(`Vendedor "${sellerId}" criado com sucesso no banco de dados!`);

    if (nameInput) nameInput.value = "";
    if (storeInput) storeInput.value = "";
    if (photoInput) photoInput.value = "";
    if (passInput) passInput.value = "";

    // Recarrega a tabela de vendedores para refletir a nova inserção
    await loadAdminMatrix();

    // Rola suavemente até a linha do novo vendedor e destaca
    const newRow = document.querySelector(`tr[data-id="${sellerId}"]`);
    if (newRow) {
      newRow.scrollIntoView({ behavior: "smooth", block: "center" });
      newRow.classList.add("save-success");
      setTimeout(() => newRow.classList.remove("save-success"), 3000);
    }
  } catch (e) {
    console.error("Erro ao criar vendedor no DB:", e);
    alert("Erro ao criar vendedor: " + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

async function addNewLesson() {
  const moduleId = document.getElementById("newLessonModule").value;
  const nome = document.getElementById("newLessonName").value.trim();
  const url = document.getElementById("newLessonURL").value.trim();

  if (!moduleId || !nome || !url) return alert("Preencha todos os campos da aula (Nome e URL).");

  try {
    // Adiciona na subcoleção "Aulas". O Firestore cria a subcoleção automaticamente se não existir.
    await addDoc(collection(db, "treinamentos", moduleId, "Aulas"), {
      nome,
      url,
      criadoEm: new Date()
    });
    alert("Aula adicionada com sucesso ao módulo!");
    document.getElementById("newLessonName").value = "";
    document.getElementById("newLessonURL").value = "";
    loadAdminMatrix();
  } catch (e) {
    alert("Erro ao adicionar: " + e.message);
  }
}

async function saveAllModifiedRows() {
  const rows = document.querySelectorAll("#adminTableBody tr");
  const modifiedRows = [];

  rows.forEach(row => {
    const hasModifiedField = row.querySelector(".edit-field.modified");
    if (hasModifiedField) {
      modifiedRows.push(row.dataset.id);
    }
  });

  if (modifiedRows.length === 0) {
    return alert("Nenhuma alteração pendente para salvar.");
  }

  const btnSaveAll = document.getElementById("btnSaveAll");
  const originalText = btnSaveAll.textContent;
  btnSaveAll.disabled = true;
  btnSaveAll.textContent = "Salvando...";

  try {
    await Promise.all(modifiedRows.map(id => window.saveAdminRow(id)));
    alert("Todas as alterações foram salvas com sucesso!");
  } catch (e) {
    alert("Ocorreu um erro ao salvar algumas linhas.");
  } finally {
    btnSaveAll.disabled = false;
    btnSaveAll.textContent = originalText;
  }
}

window.toggleLessons = async (moduleId) => {
  const row = document.getElementById(`lessons-row-${moduleId}`);
  const container = document.getElementById(`lessons-container-${moduleId}`);
  
  if (row.style.display === "none") {
    row.style.display = "table-row";
    container.innerHTML = "Buscando aulas...";
    
    try {
      const snap = await getDocs(collection(db, "treinamentos", moduleId, "Aulas"));
      if (snap.empty) {
        container.innerHTML = "<p style='text-align:center; color:var(--muted); font-size:0.8rem;'>Nenhuma aula cadastrada para este módulo.</p>";
        return;
      }

      const lessons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lessons.sort((a, b) => {
        const extractNum = (str) => {
          const match = String(str).match(/Aula\s*(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        };
        return extractNum(a.nome) - extractNum(b.nome);
      });

      container.innerHTML = `
        <h4 style="margin: 0 0 15px 0; font-size: 0.8rem; color: var(--red); text-transform: uppercase;">Gerenciar Aulas</h4>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${lessons.map(l => `
            <div style="display:flex; gap:10px; align-items:center; background: var(--bg-muted); padding: 8px; border-radius: 6px;">
              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; font-weight:800; color:var(--muted); text-transform:uppercase;">Nome</label>
                <input type="text" class="lesson-name-${l.id}" value="${l.nome}" style="width:100%; height:32px; border-radius:4px; border:1px solid var(--line); padding:0 8px; font-weight:600;">
              </div>
              <div style="flex:2; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; font-weight:800; color:var(--muted); text-transform:uppercase;">URL Vídeo</label>
                <input type="text" class="lesson-url-${l.id}" value="${l.url}" style="width:100%; height:32px; border-radius:4px; border:1px solid var(--line); padding:0 8px;">
              </div>
              <div style="display:flex; gap:5px; align-self: flex-end; padding-bottom:2px;">
                <button class="btn-row-action" onclick="window.saveLesson('${moduleId}', '${l.id}')" style="background:var(--ink); color:#fff; width:32px; height:32px;" title="Salvar Aula">💾</button>
                <button class="btn-row-action" onclick="window.deleteLesson('${moduleId}', '${l.id}')" style="background:var(--red); color:#fff; width:32px; height:32px;" title="Excluir Aula">🗑️</button>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (e) {
      container.innerHTML = "Erro ao carregar aulas.";
    }
  } else {
    row.style.display = "none";
  }
};

window.saveLesson = async (moduleId, lessonId) => {
  const nome = document.querySelector(`.lesson-name-${lessonId}`).value.trim();
  const url = document.querySelector(`.lesson-url-${lessonId}`).value.trim();
  
  if (!nome || !url) return alert("Nome e URL da aula são obrigatórios.");

  try {
    await updateDoc(doc(db, "treinamentos", moduleId, "Aulas", lessonId), { 
      nome, 
      url,
      atualizadoEm: new Date() 
    });
    alert("Aula atualizada com sucesso!");
  } catch (e) {
    alert("Erro ao salvar aula.");
  }
};

window.deleteLesson = async (moduleId, lessonId) => {
  if (!confirm("Deseja realmente excluir esta aula? Esta ação não pode ser desfeita.")) return;
  try {
    await deleteDoc(doc(db, "treinamentos", moduleId, "Aulas", lessonId));
    alert("Aula excluída!");
    const row = document.getElementById(`lessons-row-${moduleId}`);
    row.style.display = "none"; // Fecha para forçar reload no próximo clique
  } catch (e) {
    alert("Erro ao excluir aula.");
  }
};
