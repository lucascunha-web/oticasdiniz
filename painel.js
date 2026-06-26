import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { collection, collectionGroup, doc, getDoc, getDocs, getFirestore, initializeFirestore, persistentLocalCache, query, where, addDoc, updateDoc, increment, serverTimestamp, onSnapshot, documentId } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

const user = sessionStorage.getItem("usuarioLogado");
// Store unsubscribe functions for real-time listeners
let unsubscribeSellerMetrics = null;
let unsubscribeStoreMetrics = null;

// Global variables to store day configurations for daily goal calculations
let globalDiasTrabalhados = 1;
let globalFeriados = 4;

const role = sessionStorage.getItem("usuarioCargo") || "";

// --- Gerenciamento de Tema (Dark Mode) ---
const themeCheckbox = document.getElementById("themeCheckbox");
const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (themeCheckbox) {
    themeCheckbox.checked = theme === "dark";
  }
};

// Inicialização do tema
const savedTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");

// Garantir que o DOM está carregado para o checkbox
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(initialTheme);
  document.getElementById("themeCheckbox")?.addEventListener("change", (e) => {
    applyTheme(e.target.checked ? "dark" : "light");
  });
});

if (!user) {
  window.location.href = "login.html";
}

const normalizedRole = normalizeText(role);
const isSeller = normalizedRole === "vendedor";
const canSwitchRanking = ["admin", "administrador", "gerente"].includes(normalizedRole);
const monthKey = getCurrentMonthKey();
const rankings = {};

const metrics = {
  faturamento: {
    label: "Faturamento",
    format: formatCurrency,
    sort: "desc"
  },
  ticketMedio: {
    label: "Ticket Medio",
    format: formatCurrency,
    sort: "desc"
  },
  desconto: {
    label: "Desconto",
    format: formatPercent,
    sort: "asc"
  },
  vendas: {
    label: "N de Vendas",
    format: formatInteger,
    sort: "desc"
  },
  avaliacoes: {
    label: "Avaliacoes",
    format: formatInteger,
    sort: "desc"
  }
};

document.getElementById("userName").textContent = formatName(user || "Usuario");
document.getElementById("monthLabel").textContent = `Referencia ${formatMonth(monthKey)}`;

if (!isSeller) {
  document.getElementById("sellerIndicators").hidden = true;
}

if (!canSwitchRanking) {
  document.getElementById("rankingSwitch").hidden = true;
}

document.getElementById("rankingSwitch").addEventListener("change", (event) => {
  renderRanking(event.target.value);
});

document.getElementById("profileAvatar").addEventListener("click", () => {
  toggleProfileMenu();
});

document.getElementById("announcementsButton").addEventListener("click", () => {
  toggleAnnouncements(true);
});

document.getElementById("closeAnnouncements").addEventListener("click", () => {
  toggleAnnouncements(false);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile-menu")) {
    setProfileMenu(false);
  }

  if (
    !event.target.closest(".announcements-card") &&
    !event.target.closest("#announcementsButton")
  ) {
    toggleAnnouncements(false);
  }
});

document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "login.html";
});

loadPanel();

// Escuta comunicados em tempo real (Cache-friendly)
listenAnnouncements();

// --- Sistema de Treinamentos ---
const trainingsButton = document.getElementById("trainingsButton");
const trainingsPanel = document.getElementById("trainingsPanel");
const trainingsContainer = document.getElementById("trainingsContainer");

trainingsButton?.addEventListener("click", (e) => {
  e.preventDefault();
  trainingsPanel.classList.add("open");
  document.body.classList.add("modal-open");
  loadTrainings();
});

document.getElementById("closeTrainings")?.addEventListener("click", () => {
  trainingsPanel.classList.remove("open");
  document.body.classList.remove("modal-open");
});

async function loadTrainings() {
  trainingsContainer.innerHTML = "<p class='empty-state'>Carregando treinamentos...</p>";
  
  try {
    const querySnapshot = await getDocs(collection(db, "treinamentos"));
    if (querySnapshot.empty) {
      trainingsContainer.innerHTML = "<p class='empty-state'>Nenhum treinamento disponível.</p>";
      return;
    }

    const columnsHtml = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const titulo = data.titulo || "Módulo sem título";
      const apostilaUrl = data.apostila || "";
      
      // Busca subcoleção de Aulas
      const aulasSnap = await getDocs(collection(db, "treinamentos", docSnap.id, "Aulas"));
      
      let lessonsHtml = "";
      if (aulasSnap.empty) {
        lessonsHtml = "<p style='font-size:0.75rem; color:var(--muted); text-align:center; padding:20px;'>Módulo indisponível</p>";
      } else {
        // Converte para array e aplica ordenação NATURAL (Aula 1, Aula 2, Aula 10...)
        const aulas = aulasSnap.docs.map(aulaDoc => ({ id: aulaDoc.id, ...aulaDoc.data() }));
        
        aulas.sort((a, b) => {
          const extractNum = (str) => {
            const match = str.match(/Aula\s*(\d+)/i);
            return match ? parseInt(match[1], 10) : 0;
          };
          return extractNum(a.nome) - extractNum(b.nome);
        });

        lessonsHtml = aulas.map(aula => {
          return `
            <div class="lesson-card" onclick="window.openLessonVideo('${aula.nome}', '${aula.url}')">
              ${aula.nome}
            </div>
          `;
        }).join("");
      }

      return `
        <div class="module-column">
          <div class="module-header">
            <h3>${titulo}</h3>
            ${apostilaUrl ? `<a href="${apostilaUrl}" target="_blank" class="btn-apostila" title="Ver Apostila">📕</a>` : ""}
          </div>
          <div class="lessons-list">
            ${lessonsHtml}
          </div>
        </div>
      `;
    }));

    trainingsContainer.innerHTML = columnsHtml.join("");
  } catch (error) {
    console.error("Erro ao carregar treinamentos:", error);
    trainingsContainer.innerHTML = "<p class='empty-state'>Erro ao carregar dados do Firebase.</p>";
  }
}

window.openLessonVideo = (nome, url) => {
  const modal = document.getElementById("videoModal");
  const iframe = document.getElementById("videoIframe");
  document.getElementById("videoTitle").textContent = nome;
  
  // Formata URL do Google Drive para modo preview (incorporável)
  let embedUrl = url;
  if (url.includes("drive.google.com")) {
    embedUrl = url.replace(/\/view.*$/, "/preview").replace(/\/edit.*$/, "/preview");
  }

  iframe.src = embedUrl;
  modal.style.display = "flex";
  document.body.classList.add("modal-open");
};

document.getElementById("closeVideoModal")?.addEventListener("click", () => {
  document.getElementById("videoModal").style.display = "none";
  document.getElementById("videoIframe").src = "";
  if (!trainingsPanel.classList.contains("open")) {
    document.body.classList.remove("modal-open");
  }
});

const roleNorm = normalizeText(role);
const isControlRole = ["admin", "administrador", "estoquista"].includes(roleNorm);

// --- Sistema de Notificação de Reservas (Real-time) ---
if (isControlRole) {
  const qReservas = query(collection(db, "reserva"), where("status", "==", "AGUARDANDO"));
  let firstLoad = true;

  onSnapshot(qReservas, (snapshot) => {
    const count = snapshot.size;
    updatePendingReservationsUI(count);

    // Notifica sonoramente se uma nova reserva chegar após o carregamento inicial
    if (!firstLoad && !snapshot.metadata.hasPendingWrites && snapshot.docChanges().some(c => c.type === "added")) {
      playNotificationSound();
    }
    firstLoad = false;
  });
}

function updatePendingReservationsUI(count) {
  // 1. Atualiza o botão no Menu Superior (Header)
  const stockBtn = document.getElementById("stockButton");
  if (stockBtn) {
    let badge = stockBtn.querySelector(".notification-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "notification-badge";
        stockBtn.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  // 2. Atualiza o botão dentro do painel de Lentes
  const viewResBtn = document.getElementById("btnViewReservas");
  if (viewResBtn) {
    viewResBtn.innerHTML = `Visualizar Reservas AGUARDANDO ${count > 0 ? `(${count})` : ''} 📋`;
    viewResBtn.classList.toggle("pending-alert", count > 0);
  }
}

function playNotificationSound() {
  // Som de notificação sutil
  const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  audio.play().catch(() => console.log("O navegador bloqueou o autoplay do som. Interaja com a página primeiro."));
}

// --- Lógica de Lentes de Estoque ---
const stockButton = document.getElementById("stockButton");
const stockPanel = document.getElementById("stockPanel");
const stockCardContainer = document.getElementById("stockCardContainer");
const stockAdminSection = document.getElementById("stockAdminSection");
const reservasListPanel = document.getElementById("reservasListPanel");
const closeStock = document.getElementById("closeStock");
const osModal = document.getElementById("osModal");
let pendingReservation = null;

stockButton?.addEventListener("click", (e) => {
  e.preventDefault();
  populateStockSelects();
  stockPanel.classList.add("open");
  document.body.classList.add("modal-open");
  
  // Se for ADM/Estoquista, expande o card e mostra a coluna lateral
  if (isControlRole && stockCardContainer && stockAdminSection) {
    stockCardContainer.classList.add("admin-view");
    stockAdminSection.style.display = "block";
    populateBalancoSelects();
  }
});

closeStock?.addEventListener("click", () => {
  stockPanel.classList.remove("open");
  stockCardContainer.classList.remove("admin-view");
  stockAdminSection.style.display = "none";
  document.body.classList.remove("modal-open");
});

// --- Lógica de Alternância de Lentes (Barras) ---
// --- Lógica de Abas do Balanço de Estoque ---
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("balanco-tab")) {
    const btn = e.target;
    document.querySelectorAll(".balanco-tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");

    const val = btn.dataset.value;
    const input = document.getElementById("balancoTipo");
    if (input) {
      input.value = val;
      fetchCurrentBalanco();
    }
  }
});

// Fechar painel de reservas
document.getElementById("closeReservasList")?.addEventListener("click", () => {
  reservasListPanel.classList.remove("open");
  if (!stockPanel.classList.contains("open")) {
    document.body.classList.remove("modal-open");
  }
});

function populateBalancoSelects() {
  const esf = document.getElementById("balancoEsferico");
  const cil = document.getElementById("balancoCilindrico");
  if (!esf || esf.options.length > 0) return;
  
  const optionsEsferico = [];
  for (let i = 4; i >= -4; i -= 0.25) optionsEsferico.push(formatGrade(i));
  const optionsCilindrico = [];
  for (let i = 0; i >= -2; i -= 0.25) optionsCilindrico.push(formatGrade(i));

  esf.innerHTML = optionsEsferico.map(val => `<option value="${val}">${val}</option>`).join("");
  cil.innerHTML = optionsCilindrico.map(val => `<option value="${val}">${val}</option>`).join("");
  
  esf.value = "0.00";
  cil.value = "0.00";
  fetchCurrentBalanco();
}

async function fetchCurrentBalanco() {
  const tipo = document.getElementById("balancoTipo").value;
  const esf = document.getElementById("balancoEsferico").value;
  const cil = document.getElementById("balancoCilindrico").value;
  const docId = `${tipo}_E${esf}_C${cil}`;
  
  const container = document.querySelector(".balanco-card");
  if (container) {
    container.classList.remove("type-AR", "type-FILTRO_AZUL", "type-ZEISS");
    container.classList.add(`type-${tipo}`);
  }

  const snap = await getDoc(doc(db, "estoque", docId));
  const qtyInput = document.getElementById("balancoQty");
  if (qtyInput) qtyInput.value = snap.exists() ? snap.data().quantidade : 0;
}

// Listeners para atualizar os dados do balanço ao trocar o grau
document.getElementById("balancoEsferico")?.addEventListener("change", fetchCurrentBalanco);
document.getElementById("balancoCilindrico")?.addEventListener("change", fetchCurrentBalanco);

document.getElementById("btnUpdateBalanco")?.addEventListener("click", async () => {
  const tipo = document.getElementById("balancoTipo").value;
  const esf = document.getElementById("balancoEsferico").value;
  const cil = document.getElementById("balancoCilindrico").value;
  const qty = Number(document.getElementById("balancoQty").value);
  const docId = `${tipo}_E${esf}_C${cil}`;

  try {
    await updateDoc(doc(db, "estoque", docId), { 
      quantidade: qty, 
      atualizadoEm: serverTimestamp() 
    });
    alert("Quantidade atualizada com sucesso!");
    
    // Se a grade estiver aberta atrás, atualiza a visualização
    if (document.getElementById("stockResults").innerHTML !== "") {
        document.getElementById("btnConsultarEstoque").click();
    }
  } catch (e) { 
    console.error(e);
    alert("Erro ao atualizar o estoque."); 
  }
});

function populateStockSelects() {
  const esfericos = [];
  for (let i = 4; i >= -4; i -= 0.25) esfericos.push(formatGrade(i));
  
  const cilindricos = [];
  for (let i = 0; i >= -2; i -= 0.25) cilindricos.push(formatGrade(i));

  const selectsEsferico = document.querySelectorAll("#odEsferico, #oeEsferico");
  const selectsCilindrico = document.querySelectorAll("#odCilindrico, #oeCilindrico");

  const populate = (list, options) => {
    list.forEach(select => {
      if (select.options.length === 0) {
        select.innerHTML = options.map(val => `<option value="${val}">${val}</option>`).join("");
        // Default para 0.00
        select.value = "0.00";
      }
    });
  };

  populate(selectsEsferico, esfericos);
  populate(selectsCilindrico, cilindricos);
}

function formatGrade(value) {
  if (value === 0) return "0.00";
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2);
}

document.getElementById("btnConsultarEstoque")?.addEventListener("click", async () => {
  const resultsContainer = document.getElementById("stockResults");
  const btn = document.getElementById("btnConsultarEstoque");
  
  const od = { esf: document.getElementById("odEsferico").value, cil: document.getElementById("odCilindrico").value };
  const oe = { esf: document.getElementById("oeEsferico").value, cil: document.getElementById("oeCilindrico").value };

  btn.disabled = true;
  btn.textContent = "Consultando...";
  resultsContainer.innerHTML = "<p style='text-align:center'>Buscando informações...</p>";

  try {
    const brands = [
      { key: "AR", label: "Anti-Reflexo", img: "ar.jpg" },
      { key: "FILTRO_AZUL", label: "Filtro Azul", img: "filtroazul.jpg" },
      { key: "ZEISS", label: "Zeiss", img: "zeiss.png" }
    ];

    const fetchBrandResults = async (brand) => {
      const idOD = `${brand.key}_E${od.esf}_C${od.cil}`;
      const idOE = `${brand.key}_E${oe.esf}_C${oe.cil}`;

      const [snapOD, snapOE] = await Promise.all([
        getDoc(doc(db, "estoque", idOD)),
        getDoc(doc(db, "estoque", idOE))
      ]);

      const qtyOD = snapOD.exists() ? snapOD.data().quantidade : 0;
      const qtyOE = snapOE.exists() ? snapOE.data().quantidade : 0;

      const isSameLens = idOD === idOE;
      const canReserve = isSameLens ? (qtyOD >= 2) : (qtyOD >= 1 && qtyOE >= 1);

      return `
        <div class="brand-stock-card">
          <div class="brand-visual">
            <img src="${brand.img}" alt="${brand.label}">
            <div>
              <h4>${brand.label}</h4>
              <button class="btn-reserve-item ${!canReserve ? 'disabled' : ''}" 
                ${canReserve ? `onclick="window.openReserveModal('${brand.key}', '${brand.label}', '${idOD}', '${idOE}')"` : ''}>
                ${canReserve ? 'Reservar' : 'Indisponível'}
              </button>
            </div>
          </div>
          <div class="brand-qty-row">
            <div class="qty-col">
              <span class="label">OD</span>
              <span class="value ${qtyOD > 0 ? 'has-stock' : 'empty'}">${qtyOD}</span>
            </div>
            <div class="qty-col">
              <span class="label">OE</span>
              <span class="value ${qtyOE > 0 ? 'has-stock' : 'empty'}">${qtyOE}</span>
            </div>
          </div>
        </div>
      `;
    };

    const resultsHtml = await Promise.all(brands.map(fetchBrandResults));
    resultsContainer.innerHTML = resultsHtml.join("");

  } catch (error) {
    console.error("Erro na consulta:", error);
    resultsContainer.innerHTML = "<p style='color:var(--red)'>Erro ao consultar o banco de dados.</p>";
  } finally {
    btn.disabled = false;
    btn.textContent = "Consultar Disponibilidade";
  }
});

// Função Global para Relatórios (Matriz)
window.generateMatrixReport = async (tipo) => {
  try {
    // Otimização: Busca apenas as lentes da marca selecionada (Ex: AR_...)
    const q = query(collection(db, "estoque"), where("__name__", ">=", tipo + "_"), where("__name__", "<", tipo + "_\uf8ff"));
    const snapshot = await getDocs(q);
    const data = {};
    snapshot.docs.forEach(d => { data[d.id] = d.data().quantidade; });

    const esfericos = [];
    for (let i = 4; i >= -4; i -= 0.25) esfericos.push(i);
    const cilindricos = [];
    for (let i = 0; i >= -2; i -= 0.25) cilindricos.push(i);

    const format = (v) => (v === 0 ? "0.00" : (v > 0 ? "+" : "") + v.toFixed(2));

    let html = `<div id="reportPrintArea">
      <h2 style="text-align:center">Relatório de Estoque: ${tipo.replace('_', ' ')}</h2>
      <table class="print-matrix">
        <thead><tr><th>ESF / CIL</th>${cilindricos.map(c => `<th>${format(c)}</th>`).join('')}</tr></thead>
        <tbody>`;

    esfericos.forEach(e => {
      html += `<tr><td><strong>${format(e)}</strong></td>`;
      cilindricos.forEach(c => {
        const id = `${tipo}_E${format(e)}_C${format(c)}`;
        const qty = data[id] || 0;
        const cls = qty < 2 ? 'qty-low' : (qty > 5 ? 'qty-high' : '');
        html += `<td class="${cls}">${qty}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Relatório ${tipo}</title>`);
    printWindow.document.write(`<style>
      body { font-family: sans-serif; padding: 20px; }
      .print-matrix { width: 100%; border-collapse: collapse; font-size: 8pt; }
      .print-matrix th, .print-matrix td { border: 1px solid #ccc; padding: 4px; text-align: center; }
      .qty-low { background-color: #ffcccc !important; color: #cc0000; font-weight: bold; }
      .qty-high { background-color: #ccffcc !important; color: #006600; font-weight: bold; }
      th { background: #eee; }
    </style></head><body>${html}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);

  } catch (e) { 
    console.error(e);
    alert("Erro ao gerar relatório."); 
  }
};

// Modais e Ações de Reserva
window.openReserveModal = (brandKey, brandLabel, idOD, idOE) => {
  pendingReservation = { brandKey, brandLabel, idOD, idOE };
  osModal.style.display = "flex";
  document.body.classList.add("modal-open");
};

document.getElementById("closeOSModal")?.addEventListener("click", () => {
  osModal.style.display = "none";
  if (!stockPanel.classList.contains("open")) {
    document.body.classList.remove("modal-open");
  }
});

document.getElementById("confirmReserveAction")?.addEventListener("click", async () => {
  const os = document.getElementById("osNumberInput").value.trim();
  if (!os) return alert("É obrigatório informar o número da OS.");

  try {
    // Verificar se OS já existe
    const q = query(collection(db, "reserva"), where("os", "==", os));
    const osSnap = await getDocs(q);
    const hasActive = osSnap.docs.some(d => d.data().status !== "CANCELADO");
    if (hasActive) return alert("Este número de OS já possui uma reserva ativa.");

    await addDoc(collection(db, "reserva"), {
      ...pendingReservation,
      os,
      usuario: user,
      status: "AGUARDANDO",
      dataReserva: serverTimestamp()
    });

    alert("Reserva realizada com sucesso!");
    osModal.style.display = "none";
    document.getElementById("osNumberInput").value = "";
    document.getElementById("btnConsultarEstoque").click(); // Atualiza grade
  } catch (e) {
    alert("Erro ao salvar reserva.");
  }
});

document.getElementById("btnViewReservas")?.addEventListener("click", async () => {
  reservasListPanel.classList.add("open");
  document.body.classList.add("modal-open");
  const container = document.getElementById("reservasItemsContainer");
  container.innerHTML = "Carregando...";

  try {
    // Filtra apenas status AGUARDANDO conforme solicitado
    const q = query(collection(db, "reserva"), where("status", "==", "AGUARDANDO"));
    
    const snap = await getDocs(q);
    const reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Se não for admin/estoquista, vê apenas as suas em AGUARDANDO
    const filtered = isControlRole ? reservas : reservas.filter(r => r.usuario === user);

    if (!filtered.length) {
      container.innerHTML = "<p class='empty-state'>Nenhuma reserva AGUARDANDO no momento.</p>";
      return;
    }

    container.innerHTML = filtered.map(r => {
      // Extrai os graus das strings de ID (ex: AR_E+0.25_C-1.25 -> E+0.25 C-1.25)
      const formatGrau = (id) => id.split('_').slice(1).join(' ').replace('E', 'Esf: ').replace('C', 'Cil: ');
      
      return `
        <div class="reserva-item-card">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <strong>OS: ${r.os}</strong>
            <span class="reserva-badge status-${r.status}">${r.status}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--ink); margin: 8px 0;">
            <strong>Lente:</strong> ${r.brandLabel} <br>
            <span style="color:var(--muted)">Por: ${r.usuario}</span>
          </div>
          <div style="background:var(--bg-muted); padding:10px; border-radius:8px; font-size:0.75rem; border: 1px solid var(--line);">
            <div style="margin-bottom:4px;"><strong>OD:</strong> ${formatGrau(r.idOD)}</div>
            <div><strong>OE:</strong> ${formatGrau(r.idOE)}</div>
          </div>
          <div class="reserva-footer">
            ${isControlRole ? `<button class="btn-separate" onclick="window.separateAction('${r.id}', '${r.idOD}', '${r.idOE}')">Separar Estoque</button>` : ''}
            <button class="btn-cancel-reserva" onclick="window.cancelReserva('${r.id}')">Cancelar</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) { container.innerHTML = "Erro ao carregar."; }
});

window.separateAction = async (resId, idOD, idOE) => {
  if (!confirm("Confirmar a saída desta lente do estoque?")) return;
  try {
    await updateDoc(doc(db, "estoque", idOD), { quantidade: increment(-1) });
    await updateDoc(doc(db, "estoque", idOE), { quantidade: increment(-1) });
    await updateDoc(doc(db, "reserva", resId), { status: "RESERVADO" });
    alert("Estoque atualizado e item marcado como RESERVADO!");
    document.getElementById("btnViewReservas").click();
  } catch (e) { alert("Erro ao processar saída."); }
};

window.cancelReserva = async (resId) => {
  if (!confirm("Deseja cancelar esta reserva?")) return;
  try {
    await updateDoc(doc(db, "reserva", resId), { status: "CANCELADO" });
    document.getElementById("btnViewReservas").click();
  } catch (e) { alert("Erro ao cancelar."); }
};

// Lógica do menu Tabelas
const tabelasToggle = document.getElementById("tabelasToggle");
const tabelasDropdown = document.getElementById("tabelasDropdown");
const menuToggle = document.getElementById("mobileMenuToggle");
const topNav = document.querySelector(".top-nav");

menuToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = topNav.classList.toggle("active");
  menuToggle.classList.toggle("open", isOpen);
  document.body.classList.toggle("modal-open", isOpen);
});

tabelasToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  tabelasDropdown.classList.toggle("show");
});

document.querySelectorAll("#tabelasDropdown button").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    openTabelasPanel(type);
    tabelasDropdown.classList.remove("show");
  });
});

document.getElementById("closeTabelas")?.addEventListener("click", () => {
  document.getElementById("tabelasPanel").classList.remove("open");
});

// Unsubscribe all listeners on logout
document.getElementById("logoutButton").addEventListener("click", () => {
  if (unsubscribeSellerMetrics) unsubscribeSellerMetrics();
  if (unsubscribeStoreMetrics) unsubscribeStoreMetrics();
  // Add other unsubscribe calls here if more listeners are added
  sessionStorage.clear();
  window.location.href = "login.html";
});

async function loadPanel() {
  setRankingLoading();

  // Fetch global day configurations from the 'GERAL' store document
  try {
    const geralRef = doc(db, "lojas", "GERAL");
    const geralSnap = await getDoc(geralRef);
    if (geralSnap.exists()) {
      const data = geralSnap.data();
      globalDiasTrabalhados = Number(data.diasTrabalhados ?? 1);
      globalFeriados = Number(data.feriados ?? 4);
    }
  } catch (e) { console.error("Erro ao carregar configurações globais de dias:", e); }
  try {
    // Fetch seller profile once
    const currentSeller = await getSellerProfile(user);
    setProfilePhoto(currentSeller.photo);

    // Fetch all sellers data once to map names to photos
    const sellersSnap = await getDocs(collection(db, "vendedores"));
    const sellersMap = {};
    sellersSnap.forEach(doc => sellersMap[doc.id] = doc.data());

    // Setup real-time listener for seller metrics
    if (unsubscribeSellerMetrics) {
      unsubscribeSellerMetrics(); // Unsubscribe from previous listener if any
    }

    const curMonthKey = getCurrentMonthKey();
    const prevMonthKey = getPreviousMonthKey();

    const qSellerMetrics = query(collectionGroup(db, "metricas"));

    let initialLoadComplete = false;

    unsubscribeSellerMetrics = onSnapshot(qSellerMetrics, (snapshot) => {
      // Fallback para o mês anterior se não houver dados no mês atual para vendedores
      const hasCurrentMonthData = snapshot.docs.some(d => d.id === curMonthKey && d.ref.path.includes("vendedores/"));
      const displayMonth = hasCurrentMonthData ? curMonthKey : prevMonthKey;

      document.getElementById("monthLabel").textContent = `Referencia ${formatMonth(displayMonth)}`;

      const allSellerMetrics = snapshot.docs
        .filter((metricDoc) => {
          const sellerRef = metricDoc.ref.parent.parent;
          const sellerId = sellerRef?.id;
          
          const isCurrentMonth = metricDoc.id === curMonthKey;
          const isActive = sellersMap[sellerId]?.ativo !== false;

          return metricDoc.id === displayMonth && 
                 sellerRef?.parent.id === "vendedores" &&
                 (isActive || !isCurrentMonth); // No mês atual respeita o status, no histórico mostra se houver dados
        })
        .map((metricDoc) => {
          const sellerId = metricDoc.ref.parent.parent.id;
          const sellerData = sellersMap[sellerId] || {};
          return normalizeMetricRecord(sellerId, metricDoc.data(), sellerData);
        });

      Object.keys(metrics).forEach((metricKey) => {
        rankings[metricKey] = buildRanking(allSellerMetrics, metricKey);
      });

      if (isSeller) {
        const sellerMetrics = allSellerMetrics.find(m => normalizeText(m.name) === normalizeText(user));
        if (sellerMetrics) {
          renderSellerIndicators(sellerMetrics);
        } else {
          console.warn(`No metrics found for current seller ${user} for month ${monthKey}`);
          // Optionally clear or set default indicators if no metrics found
          // For example: renderSellerIndicators(normalizeMetricRecord(user, {}));
        }
      }

      renderRanking("faturamento"); // Render default ranking

      // Esconde o loader após a primeira carga de dados
      if (!initialLoadComplete) {
        const loader = document.getElementById("loaderOverlay");
        if (loader) {
          loader.classList.add("hidden");
        }
        initialLoadComplete = true;
      }
    }, (error) => {
      console.error("Erro ao carregar métricas de vendedor em tempo real:", error);
      document.getElementById("rankingTable").innerHTML = `
        <p class="empty-state">Nao foi possivel carregar os dados do ranking agora.</p>
      `;
      // Esconde o loader mesmo em caso de erro para não travar a tela
      document.getElementById("loaderOverlay")?.classList.add("hidden");
    });

    // Load store ranking data if applicable
    if (canSwitchRanking) {
      loadStoreRankingData();
    }

  } catch (error) {
    console.error("Erro ao carregar painel (inicial):", error);
    document.getElementById("rankingTable").innerHTML = `
      <p class="empty-state">Nao foi possivel carregar os dados do ranking agora.</p>
    `;
    // Esconde o loader mesmo em caso de erro para não travar a tela
    document.getElementById("loaderOverlay")?.classList.add("hidden");
  }
}

async function getSellerMetrics(sellerName) {
  // This function is still used by renderSellerIndicators, but now the data comes from the allSellerMetrics array
  // It's better to get the seller's metrics from the `allSellerMetrics` array that `onSnapshot` provides.
  // For now, keeping it as getDoc for direct fetch if needed, but it might become redundant.
  const metricRef = doc(db, "vendedores", sellerName, "metricas", monthKey);
  const metricSnap = await getDoc(metricRef);

  if (!metricSnap.exists()) {
    return normalizeMetricRecord(sellerName, {});
  }

  return normalizeMetricRecord(sellerName, metricSnap.data());
}

async function getSellerProfile(sellerName) {
  const sellerRef = doc(db, "vendedores", sellerName);
  const sellerSnap = await getDoc(sellerRef);

  if (!sellerSnap.exists()) {
    return { photo: "" };
  }

  return {
    photo: normalizePhotoUrl(sellerSnap.data().foto || "")
  };
}

function normalizeMetricRecord(name, data, sellerData = {}) {
  return {
    name,
    photo: normalizePhotoUrl(sellerData.foto || ""),
    avaliacoes: Number(data.avaliacoes ?? 0),
    desconto: Number(data.desconto ?? 0),
    faturamento: Number(data.faturamento ?? 0),
    projeção: Number(data.projeção ?? 0),
    metaComissao: Number(data.metaComissao ?? 0),
    metaFaturamento: Number(data.metaFaturamento ?? 0),
    ticketMedio: Number(data.ticketMedio ?? 0),
    vendas: Number(data.vendas ?? 0)
  };
}

function buildRanking(records, metricKey) {
  const direction = metrics[metricKey].sort;

  return [...records]
    .sort((a, b) => {
      const comparison = Number(a[metricKey]) - Number(b[metricKey]);
      return direction === "asc" ? comparison : comparison * -1;
    })
    .map((record, index) => ({
      ...record,
      position: index + 1
    }));
}

function renderSellerIndicators(sellerMetrics) {
  Object.entries(metrics).forEach(([metricKey, config]) => {
    const metricElement = document.querySelector(`[data-metric="${metricKey}"]`);
    const rankElement = document.querySelector(`[data-rank="${metricKey}"]`);
    const statusElement = document.querySelector(`[data-status="${metricKey}"]`);
    const pctElement = document.querySelector(`[data-pct="${metricKey}"]`);
    const rankingItem = rankings[metricKey]?.find((item) => normalizeText(item.name) === normalizeText(user));

    if (metricElement) metricElement.textContent = config.format(sellerMetrics[metricKey]);
    if (rankElement) rankElement.textContent = rankingItem ? `Minha Posição ${rankingItem.position}º` : "Minha Posição --";

    const active = isStatusActive(metricKey, sellerMetrics);
    let statusText = getStatusText(metricKey, active);

    if (metricKey === "faturamento") {
      const fat = Number(sellerMetrics.faturamento);
      const metaF = Number(sellerMetrics.metaFaturamento);
      const isMetaHit = fat >= metaF && metaF > 0;
      const metaDiariaElem = document.querySelector(`[data-metric="metaDiaria"]`);
      const metaDiariaLabelElem = document.querySelector(`[data-label="metaDiaria"]`);

      if (isMetaHit) {
        // Se a meta foi batida, mostra o saldo positivo
        const saldo = fat - metaF;
        if (metaDiariaElem) {
          metaDiariaElem.textContent = `+${formatCurrency(saldo)}`;
          metaDiariaElem.style.color = "var(--green)";
        }
        if (metaDiariaLabelElem) metaDiariaLabelElem.textContent = "Saldo da Meta";
      } else {
        // Se não, calcula e mostra a meta diária
        const [year, mNum] = monthKey.split("-").map(Number);
        // mNum já é 1-based, então new Date(year, mNum, 0) pega o último dia do mês correto
        const totalDays = new Date(year, mNum, 0).getDate();
        const diasRestantes = totalDays - globalFeriados - globalDiasTrabalhados;
        const metaDiariaVal = diasRestantes > 0 ? Math.max(0, (metaF - fat) / diasRestantes) : 0;
        if (metaDiariaElem) {
          metaDiariaElem.textContent = formatCurrency(metaDiariaVal);
          metaDiariaElem.style.color = ""; // Reseta a cor para o padrão
        }
        if (metaDiariaLabelElem) metaDiariaLabelElem.textContent = "Meta Diária Atual";
      }

      const pctMeta = metaF > 0 ? (fat / metaF) * 100 : 0;

      if (isMetaHit) {
        statusText = "Meta Batida";
        if (statusElement) {
          statusElement.style.background = "#3182ce";
          statusElement.classList.remove("inactive");
        }
      } else {
        if (statusElement) {
          statusElement.style.background = ""; 
          statusElement.classList.toggle("inactive", !active);
        }
      }
      
      // Removemos a exibição do status e porcentagem no faturamento conforme solicitado
      if (statusElement) statusElement.hidden = true;
      if (pctElement) pctElement.hidden = true;

    } else {
      if (statusElement) {
        statusElement.textContent = statusText;
        statusElement.hidden = !statusText;
        statusElement.style.background = "";
        statusElement.classList.toggle("inactive", Boolean(statusText) && !active);
      }

      if (pctElement) {
        pctElement.hidden = true;
      }
    }
  });
}

function renderRanking(metricKey) {
  const ranking = rankings[metricKey] || [];
  const config = metrics[metricKey];
  const table = document.getElementById("rankingTable");
  const isFat = metricKey === "faturamento";

  document.getElementById("rankingTitle").textContent = `Ranking de ${config.label}`;

  if (!ranking.length) {
    table.innerHTML = `<p class="empty-state">Nenhum dado de ${config.label.toLowerCase()} encontrado para este mes.</p>`;
    return;
  }

  const values = ranking.map((item) => Number(item[metricKey]));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);

  table.innerHTML = ranking
    .map((item) => {
      const width = getProgressWidth(item[metricKey], minValue, maxValue, config.sort);
      const active = isStatusActive(metricKey, item);
      const statusText = getStatusText(metricKey, active);
      const current = normalizeText(item.name) === normalizeText(user);
      
      let valueContent = "";
      let progressHtml = "";

      if (isFat) {
        const fat = Number(item.faturamento);
        const metaC = Number(item.metaComissao);
        const metaF = Number(item.metaFaturamento);
        
        // Lógica da Barra Proporcional à Meta
        const pctMeta = metaF > 0 ? (fat / metaF) * 100 : 0;
        const barColorClass = fat >= metaF ? "bar-goal" : (fat >= metaC ? "bar-comm" : "");

        valueContent = `
          <div class="ranking-info-cols">
            <div class="ranking-col-item"><span>Faturamento</span><strong>${config.format(fat)}</strong></div>
            <div class="ranking-col-item"><span>Projeção</span><strong>${formatCurrency(item.projeção || 0)}</strong></div>
          </div>`;

        progressHtml = `
          <div class="ranking-track goal-track">
            <div class="ranking-progress ${barColorClass}" style="width: ${Math.min(pctMeta, 100)}%"></div>
            <div class="marker-point progress-point ${barColorClass}" style="left: ${Math.min(pctMeta, 100)}%"></div>
            <div class="performance-badge" style="left: ${Math.min(pctMeta, 100)}%">${pctMeta.toFixed(0)}%</div>
          </div>`;
      } else {
        valueContent = `
          <div class="ranking-value">
            <strong>${config.format(item[metricKey])}</strong>
            ${statusText ? `<span class="${active ? "active" : "inactive"}">${statusText}</span>` : ""}
          </div>`;
        
        progressHtml = `
          <div class="ranking-track">
            <div class="ranking-progress" style="width: ${width}%"></div>
          </div>`;
      }

      return `
        <article class="ranking-item ${getPodiumClass(item.position)} ${current ? "current-user" : ""}">
          <div class="ranking-row ${isFat ? 'fat-mode' : ''}" style="margin-bottom: 15px;">
            <strong class="ranking-position">${formatPosition(item.position)}</strong>
            <div class="ranking-photo">
              ${item.photo ? `<img src="${item.photo}" alt="">` : "<span></span>"}
            </div>
            <div class="ranking-name">${formatName(item.name)}${current ? " (Voce)" : ""}</div>
            ${valueContent}
          </div>
          ${progressHtml}
        </article>
      `;
    })
    .join("");
}

function setRankingLoading() {
  document.getElementById("rankingTable").innerHTML = `<p class="empty-state">Carregando ranking...</p>`;
}

function isStatusActive(metricKey, record) {
  if (metricKey === "avaliacoes") {
    return Number(record.avaliacoes) >= 10;
  }

  if (metricKey !== "faturamento") {
    return false;
  }

  return Number(record.faturamento) > Number(record.metaComissao) && Number(record.metaComissao) > 0;
}

function getStatusText(metricKey, active) {
  if (metricKey === "avaliacoes") {
    return active ? "Ativado" : "Desativado";
  }

  if (metricKey === "faturamento") {
    return active ? "Comissao ativada" : "Comissao nao ativada";
  }

  return "";
}

function getProgressWidth(value, minValue, maxValue, sort) {
  const numericValue = Number(value);

  if (maxValue === minValue) {
    return 100;
  }

  if (sort === "asc") {
    return Math.max(((maxValue - numericValue) / (maxValue - minValue)) * 100, 8);
  }

  return Math.max((numericValue / maxValue) * 100, 8);
}

function getPodiumClass(position) {
  if (position === 1) return "gold";
  if (position === 2) return "silver";
  if (position === 3) return "bronze";
  return "";
}

function formatPosition(position) {
  if (position === 1) return "1º";
  if (position === 2) return "2º";
  if (position === 3) return "3º";
  return `${position}º`;
}

function getCurrentMonthKey() {
  const now = new Date();
  // No dia 1, o "mês atual" para o sistema ainda é o mês que acabou de fechar
  if (now.getDate() === 1) {
    now.setMonth(now.getMonth() - 1);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonthKey() {
  const now = new Date();
  // Se for dia 1, precisamos recuar dois meses (um pelo ajuste do 'atual' e outro para o 'anterior')
  if (now.getDate() === 1) {
    now.setMonth(now.getMonth() - 1);
  }
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value) {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function setProfilePhoto(photoUrl) {
  if (!photoUrl) {
    return;
  }

  document.getElementById("profileAvatar").innerHTML = `<img src="${photoUrl}" alt="">`;
}

function listenAnnouncements() {
  const list = document.getElementById("announcementsList");
  
  // onSnapshot usa o cache local e só gasta leitura se houver mudança real
  onSnapshot(collection(db, "comunicados"), (snapshot) => {
    const announcements = snapshot.docs
      .map((announcementDoc) => announcementDoc.data())
      .filter((announcement) => announcement.Titulo || announcement.URL);

    if (!announcements.length) {
      list.innerHTML = "<p>Nenhum comunicado disponível.</p>";
      return;
    }

    list.innerHTML = announcements.map((announcement) => {
      const title = escapeHtml(announcement.Titulo || "Comunicado");
      const url = String(announcement.URL || "#").trim();
      return `
        <a class="announcement-item" href="${url}" target="_blank" rel="noopener noreferrer">
          <strong>${title}</strong>
          <span>Abrir comunicado</span>
        </a>
      `;
    }).join("");
  });
}

function toggleProfileMenu() {
  const avatar = document.getElementById("profileAvatar");
  setProfileMenu(avatar.getAttribute("aria-expanded") !== "true");
}

function setProfileMenu(isOpen) {
  document.getElementById("profileAvatar").setAttribute("aria-expanded", String(isOpen));
  document.getElementById("profileDropdown").classList.toggle("open", isOpen);
}

function toggleAnnouncements(isOpen) {
  document.getElementById("announcementsButton").setAttribute("aria-expanded", String(isOpen));
  document.getElementById("announcementsPanel").classList.toggle("open", isOpen);
  document.body.classList.toggle("modal-open", isOpen);
}

function normalizePhotoUrl(value) {
  const photoUrl = String(value || "").trim();

  if (!photoUrl) {
    return "";
  }

  const driveMatch = photoUrl.match(/(?:\/d\/|id=)([-\w]{20,})/);

  if (driveMatch) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w240`;
  }

  return photoUrl;
}

function formatName(value) {
  return String(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatCurrency(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatPercent(value) {
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}%`;
}

function formatInteger(value) {
  return Number(value).toLocaleString("pt-BR");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function openTabelasPanel(type) {
  const panel = document.getElementById("tabelasPanel");
  const list = document.getElementById("tabelasContentList");
  const title = document.getElementById("tabelasPanelTitle");
  
  title.textContent = type === "precos" ? "Tabelas de Preços" : "Códigos Técnicos";
  panel.classList.add("open");
  document.body.classList.add("modal-open");
  list.innerHTML = "<p>Buscando arquivos...</p>";

  try {
    const snapshot = await getDocs(collection(db, "tabelas"));
    const filterCod = type === "codigos";
    
    const filtered = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(t => {
        const idLower = t.id.toLowerCase();
        return filterCod ? idLower.includes("cod") : !idLower.includes("cod");
      });

    if (!filtered.length) {
      list.innerHTML = "<p>Nenhum arquivo encontrado nesta categoria.</p>";
      return;
    }

    list.innerHTML = filtered.map(t => {
      const label = t.id.replace(/cod$/i, "").toUpperCase();
      const url = t.URL || "#";
      return `
        <a class="announcement-item" href="${url}" target="_blank" rel="noopener noreferrer">
          <strong>${label}</strong>
          <span>Abrir PDF da Tabela</span>
        </a>
      `;
    }).join("");

  } catch (error) {
    console.error("Erro ao carregar tabelas:", error);
    list.innerHTML = "<p>Erro ao acessar o banco de dados.</p>";
  }
}

document.addEventListener("click", () => {
  tabelasDropdown?.classList.remove("show");
});

let cachedStores = [];

async function loadStoreRankingData() {
  const section = document.getElementById("managerSection");
  const tabs = document.getElementById("storeTabs");
  const rankingList = document.getElementById("storeRankingList");

  if (!section || !tabs || !rankingList) return;

  if (unsubscribeStoreMetrics) {
    unsubscribeStoreMetrics();
  }

  const curMonthKey = monthKey;
  const prevMonthKey = getPreviousMonthKey();

  const qStoreMetrics = query(collectionGroup(db, "metricas"));

  unsubscribeStoreMetrics = onSnapshot(qStoreMetrics, async (snapshot) => {
    // Busca configurações de dias (trabalhados/feriados) salvos na raiz da coleção lojas
    const lojasSnap = await getDocs(collection(db, "lojas"));
    const configMap = {};
    lojasSnap.forEach(d => configMap[d.id] = d.data());

    const hasCurrentMonthData = snapshot.docs.some(doc => doc.id === curMonthKey && doc.ref.path.startsWith("lojas/"));
    const targetMonth = hasCurrentMonthData ? curMonthKey : prevMonthKey;

    const allMetrics = snapshot.docs
      .filter(doc => doc.id === targetMonth && doc.ref.path.startsWith("lojas/"))
      .map(doc => {
        const id = doc.ref.parent.parent.id;
        const config = configMap[id] || {};
        return { 
          id, 
          ...doc.data(),
          diasTrabalhados: config.diasTrabalhados,
          feriados: config.feriados
        };
      });

    if (allMetrics.length === 0) {
      section.style.display = "none";
      return;
    }

    // 1. Separar lojas individuais do documento GERAL
    const individualStores = allMetrics.filter(s => s.id !== "GERAL");
    let geralStore = allMetrics.find(s => s.id === "GERAL") || { id: "GERAL", desconto: 0, mkp: 0, ticketMedio: 0 };
    
    const geralConfig = configMap["GERAL"] || {};
    geralStore.diasTrabalhados = geralConfig.diasTrabalhados;
    geralStore.feriados = geralConfig.feriados;

    // 2. Calcular somas para o GERAL (Faturamento, Projeção e Vendas)
    const totals = individualStores.reduce((acc, store) => ({
      faturamento: acc.faturamento + Number(store.faturamento || 0),
      vendas: acc.vendas + Number(store.vendas || 0),
      projeção: acc.projeção + Number(store.projeção || 0),
      metaFaturamento: acc.metaFaturamento + Number(store.metaFaturamento || 0)
    }), { faturamento: 0, vendas: 0, projeção: 0, metaFaturamento: 0 });

    geralStore.faturamento = totals.faturamento;
    geralStore.vendas = totals.vendas;
    geralStore.projeção = totals.projeção;
    geralStore.metaFaturamento = totals.metaFaturamento;

    // Atualiza o cache global incluindo o GERAL processado
    cachedStores = [geralStore, ...individualStores];

    // 3. Renderizar Ranking em Lista (Ignorando o GERAL e ordenando por faturamento)
    const rankingData = [...individualStores].sort((a, b) => Number(b.faturamento || 0) - Number(a.faturamento || 0));
    
    rankingList.innerHTML = rankingData.map((store, index) => {
      const fat = Number(store.faturamento || 0);
      const mCom = Number(store.metaComissao || 0);
      const mFat = Number(store.metaFaturamento || 0);
      
      const isCommActive = fat >= mCom && mCom > 0;
      const isMetaHit = fat >= mFat && mFat > 0;

      return `
        <div class="rank-card-white">
          <div class="r-header">
            <span class="r-pos-badge">${index + 1}</span>
            <span class="r-store-name">${store.id}</span>
          </div>
          <div class="r-featured">${formatCurrency(fat)}</div>
          <div class="r-sub-info">Comissão: ${formatCurrency(mCom)}</div>
          <div class="r-sub-info">Meta: ${formatCurrency(mFat)}</div>
          <div class="r-footer-badges">
            ${isMetaHit ? 
              '<span class="s-badge blue">Meta Batida</span>' : 
              (isCommActive ? '<span class="s-badge green">Comissão Ativa</span>' : '<span class="s-badge red">Comissão não ativa</span>')}
          </div>
        </div>
      `;
    }).join("");

    // 4. Renderizar Botões de Seleção (Tabs) - Colocando o GERAL em primeiro
    const tabOrder = [geralStore, ...individualStores.sort((a, b) => a.id.localeCompare(b.id))];
    tabs.innerHTML = tabOrder.map((store, i) => `
      <button class="store-tab-btn ${store.id === 'GERAL' ? 'active' : ''}" onclick="window.switchStoreView('${store.id}')">
        ${store.id}
      </button>
    `).join("");

    // 5. Iniciar visão com o GERAL selecionado
    window.switchStoreView("GERAL");

    section.style.display = "block";
  }, (error) => {
    console.error("Erro ao carregar visão gerencial em tempo real:", error);
    section.style.display = "none";
  });
}

window.switchStoreView = (storeId) => {
  const store = cachedStores.find(s => s.id === storeId);
  if (!store) return;

  // Atualiza estado visual dos botões
  document.querySelectorAll(".store-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.innerText.trim() === storeId);
  });

  const metaF = Number(store.metaFaturamento || 0);
  const fat = Number(store.faturamento || 0);
  const isMetaHit = fat >= metaF && metaF > 0;

  let metaDiariaLabel = "Meta Diária Atual";
  let metaDiariaValue = 0;

  if (isMetaHit) {
    const saldo = fat - metaF;
    metaDiariaLabel = "Saldo da Meta";
    metaDiariaValue = `+${formatCurrency(saldo)}`;
  } else {
    const [year, month] = monthKey.split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    const dTrab = Number(store.diasTrabalhados || globalDiasTrabalhados);
    const fer = Number(store.feriados || globalFeriados);
    const diasFaltam = totalDays - fer - dTrab;
    const valor = diasFaltam > 0 ? Math.max(0, (metaF - fat) / diasFaltam) : 0;
    metaDiariaValue = formatCurrency(valor);
  }

  const display = document.getElementById("activeStoreDisplay");

  display.innerHTML = `
    <div class="ind-group featured">
      <span>Faturamento</span>
      <strong>${formatCurrency(store.faturamento || 0)}</strong>
    </div>
    <div class="ind-group featured ${isMetaHit ? 'featured-green' : ''}">
      <span>${metaDiariaLabel}</span>
      <strong>${metaDiariaValue}</strong>
    </div>
    <div class="ind-group">
      <span>N de Vendas</span>
      <strong>${formatInteger(store.vendas || 0)}</strong>
    </div>
    <div class="ind-group">
      <span>Desconto</span>
      <strong>${formatPercent(store.desconto || 0)}</strong>
    </div>
    <div class="ind-group">
      <span>MKP</span>
      <strong>${Number(store.mkp || 0).toFixed(2)}</strong>
    </div>
    <div class="ind-group">
      <span>Ticket Médio</span>
      <strong>${formatCurrency(store.ticketMedio || 0)}</strong>
    </div>
    <div class="ind-group featured-green">
      <span>Projeção</span>
      <strong>${formatCurrency(store.projeção || 0)}</strong>
    </div>
  `;
};
