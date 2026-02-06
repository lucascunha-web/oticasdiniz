const URL_API = "https://script.google.com/macros/s/AKfycbwF0o33iHkqxy11BqzFXHUPeY_2iWj1HfiMc9AWIyOYnugY_whUazaIP7q7vBhNU8-_/exec";
let abaAtualBalanco = 'ACRILICA AR';
let ultimaQtdPendentes = 0; 

document.addEventListener('DOMContentLoaded', () => {
    popularSelects();
    solicitarPermissaoNotificacao();
    
    const esfBal = document.getElementById("esfBalanco");
    const cilBal = document.getElementById("cilBalanco");
    if(esfBal) esfBal.addEventListener('change', buscarQtdBalanco);
    if(cilBal) cilBal.addEventListener('change', buscarQtdBalanco);

    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const btnBalanco = document.querySelector(".btn-balanco");
    const btnHistorico = document.querySelector(".btn-historico");

    if (user && user.nivel) {
        const nivel = user.nivel.toLowerCase().trim();
        const nomeUser = user.nome ? user.nome.toUpperCase().trim() : "";

        if (btnHistorico) btnHistorico.addEventListener('click', abrirHistorico);

        // Exibição do botão de Balanço (Apenas Estoque/Admin)
        if (btnBalanco) {
            if (nivel === "admin" || nivel === "estoquista") {
                btnBalanco.style.setProperty("display", "flex", "important");
            } else {
                btnBalanco.style.display = "none";
            }
        }

        // Inicia monitoramento (Vendedores veem os seus, LUCAS/Estoque veem todos)
        verificarNotificacoes();
        setInterval(verificarNotificacoes, 60000); 
    }
});

// --- 1. SISTEMA DE NOTIFICAÇÕES (FILTRADO POR USUÁRIO) ---

function solicitarPermissaoNotificacao() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

async function verificarNotificacoes() {
    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    if (!user) return;

    const nivel = user.nivel.toLowerCase().trim();
    const nomeUser = user.nome ? user.nome.toUpperCase().trim() : "";

    // LOGICA DE FILTRO: Se for admin/estoquista/LUCAS, busca tudo. Se não, busca só o dele.
    const ehPrivilegiado = (nivel === "admin" || nivel === "estoquista" || nomeUser === "LUCAS");
    const paramUsuario = ehPrivilegiado ? "ADMIN" : user.nome;

    try {
        const res = await fetch(`${URL_API}?action=getHistory&usuario=${encodeURIComponent(paramUsuario)}`);
        const reservas = await res.json();
        
        // Conta apenas o que está "AGUARDANDO" no lote retornado
        const pendentes = reservas.filter(r => r.status.toUpperCase() === "AGUARDANDO").length;
        
        // Notificação Nativa (Somente para LUCAS ou Estoquistas quando entra algo novo)
        if (ehPrivilegiado && (nivel === "estoquista" || nomeUser === "LUCAS")) {
            if (pendentes > ultimaQtdPendentes) {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Nova Reserva Pendente", {
                        body: `Existem ${pendentes} pedidos aguardando baixa.`,
                        icon: "https://cdn-icons-png.flaticon.com/512/1067/1067555.png"
                    });
                }
            }
        }
        ultimaQtdPendentes = pendentes;

        // Atualiza o Badge visual (bolinha vermelha no botão)
        let badge = document.getElementById("badgeNotificacao");
        if (!badge) {
            const btnHist = document.querySelector(".btn-historico");
            if(btnHist) {
                btnHist.style.position = "relative";
                btnHist.innerHTML += `<span id="badgeNotificacao" class="badge-notificacao"></span>`;
                badge = document.getElementById("badgeNotificacao");
            }
        }

        if (badge) {
            if (pendentes > 0) {
                badge.innerText = pendentes;
                badge.style.display = "flex";
            } else {
                badge.style.display = "none";
            }
        }
    } catch (e) { console.error("Erro ao processar notificações"); }
}

// --- 2. CONFIGURAÇÃO DOS SELETORES ---

function gerarValores(inicio, fim) {
    let valores = [];
    for (let i = inicio; i <= fim + 0.001; i += 0.25) {
        let s = i.toFixed(2);
        if (i > 0) s = "+" + s;
        if (Math.abs(i) < 0.01) s = "0.00";
        valores.push(s);
    }
    return valores;
}

function popularSelects() {
    const esfericos = gerarValores(-4.00, 4.00);
    const cilindricos = gerarValores(-2.00, 0.00);
    const ids = ['esfOD', 'cilOD', 'esfOE', 'cilOE', 'esfBalanco', 'cilBalanco'];
    
    ids.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const lista = id.includes('esf') ? esfericos : cilindricos;
        select.innerHTML = ""; 
        lista.forEach(v => {
            let opt = document.createElement('option');
            opt.value = v; 
            opt.innerText = v;
            select.appendChild(opt);
        });
        select.value = "0.00";
    });
}

// --- 3. CONSULTA DE ESTOQUE E RESERVA ---

async function consultarEstoque() {
    const btn = document.getElementById("btnConsultar");
    const container = document.getElementById("resultadosLentes");
    const esfOD = document.getElementById('esfOD').value;
    const cilOD = document.getElementById('cilOD').value;
    const esfOE = document.getElementById('esfOE').value;
    const cilOE = document.getElementById('cilOE').value;

    btn.innerText = "CARREGANDO...";
    btn.disabled = true;
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px;"><i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: #ddd;"></i></div>`;

    try {
        const [resOD, resOE] = await Promise.all([
            fetch(`${URL_API}?esf=${encodeURIComponent(esfOD)}&cil=${encodeURIComponent(cilOD)}`).then(r => r.json()),
            fetch(`${URL_API}?esf=${encodeURIComponent(esfOE)}&cil=${encodeURIComponent(cilOE)}`).then(r => r.json())
        ]);

        container.innerHTML = "";
        const marcas = [
            { nome: 'ACRILICA AR', classe: 'card-ar' },
            { nome: 'FILTRO AZUL', classe: 'card-filtro' },
            { nome: 'ZEISS', classe: 'card-zeiss' }
        ];

        marcas.forEach(marca => {
            const qtdOD = (resOD.estoque_por_aba && resOD.estoque_por_aba[marca.nome] !== undefined) ? parseInt(resOD.estoque_por_aba[marca.nome]) : 0;
            const qtdOE = (resOE.estoque_por_aba && resOE.estoque_por_aba[marca.nome] !== undefined) ? parseInt(resOE.estoque_por_aba[marca.nome]) : 0;
            const disponivel = qtdOD > 0 && qtdOE > 0;

            container.innerHTML += `
                <div class="card-resultado ${marca.classe}">
                    <h3>${marca.nome}</h3>
                    <div class="resultado-linha">
                        <span class="label-olho">OLHO DIREITO</span>
                        <span class="grau-info">${esfOD} / ${cilOD}</span>
                        <span class="qtd-badge" style="color: ${qtdOD > 0 ? '#2e7d32' : '#d32f2f'}">Qtd: ${qtdOD}</span>
                    </div>
                    <div class="resultado-linha">
                        <span class="label-olho">OLHO ESQUERDO</span>
                        <span class="grau-info">${esfOE} / ${cilOE}</span>
                        <span class="qtd-badge" style="color: ${qtdOE > 0 ? '#2e7d32' : '#d32f2f'}">Qtd: ${qtdOE}</span>
                    </div>
                    <div class="footer-card">
                        <span class="status-entrega" style="color: ${disponivel ? '#2e7d32' : '#d32f2f'}">
                            ● ${disponivel ? 'Pronta Entrega' : 'Indisponível'}
                        </span>
                        ${disponivel ? `<button class="btn-reservar" onclick="reservar('${marca.nome}')">RESERVAR</button>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = `<p style="grid-column: 1/-1; color:red; text-align:center;">Erro de conexão.</p>`;
    } finally {
        btn.innerText = "CONSULTAR";
        btn.disabled = false;
    }
}

async function reservar(lente) {
    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const numOS = prompt(`Digite o número da OS para a reserva de ${lente}:`);
    if (!numOS) return;

    const dataISO = new Date().toLocaleString('pt-BR');
    const esfOD = document.getElementById('esfOD').value;
    const cilOD = document.getElementById('cilOD').value;
    const esfOE = document.getElementById('esfOE').value;
    const cilOE = document.getElementById('cilOE').value;

    const url = `${URL_API}?action=reservar&usuario=${encodeURIComponent(user.nome)}&dataHora=${encodeURIComponent(dataISO)}&esfOD=${encodeURIComponent(esfOD)}&cilOD=${encodeURIComponent(cilOD)}&esfOE=${encodeURIComponent(esfOE)}&cilOE=${encodeURIComponent(cilOE)}&lente=${encodeURIComponent(lente)}&os=${encodeURIComponent(numOS)}`;

    try {
        const res = await fetch(url);
        if ((await res.json()).status === "success") {
            alert("Reserva enviada com sucesso!");
            consultarEstoque();
            verificarNotificacoes();
        }
    } catch (e) { alert("Erro ao processar reserva."); }
}

// --- 4. HISTÓRICO COM DIVISÃO VISUAL ---

function abrirHistorico() {
    document.getElementById("modalHistorico").style.display = "flex";
    buscarHistoricoReservas();
}

function fecharHistorico() {
    document.getElementById("modalHistorico").style.display = "none";
}

async function buscarHistoricoReservas() {
    const container = document.getElementById("listaHistorico");
    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i></div>`;

    try {
        const nivel = user.nivel.toLowerCase().trim();
        const nomeUser = user.nome ? user.nome.toUpperCase().trim() : "";
        const ehPrivilegiado = (nivel === "admin" || nivel === "estoquista" || nomeUser === "LUCAS");
        
        const usuarioBusca = ehPrivilegiado ? "ADMIN" : user.nome;

        const res = await fetch(`${URL_API}?action=getHistory&usuario=${encodeURIComponent(usuarioBusca)}`);
        const reservas = await res.json();

        container.innerHTML = "";
        if (reservas.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px;">Nenhuma reserva pendente.</p>`;
            return;
        }

        reservas.forEach(reserva => {
            const status = (reserva.status || "AGUARDANDO").toUpperCase();
            // Para quem dá baixa, só mostramos o que está AGUARDANDO.
            if (ehPrivilegiado && status !== "AGUARDANDO") return;
            container.innerHTML += renderizarCardHistorico(reserva, ehPrivilegiado);
        });
    } catch (e) { container.innerHTML = `<p style="text-align:center; color:red;">Erro ao carregar histórico.</p>`; }
}

function renderizarCardHistorico(res, ehAdmin) {
    const status = (res.status || "AGUARDANDO").toUpperCase();
    const corStatus = status === 'RESERVADO' ? '#2e7d32' : status === 'CANCELADO' ? '#d32f2f' : '#1976d2';

    return `
        <div class="card-historico" style="border-left: 6px solid ${corStatus}; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1)">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                    <strong style="color: #d32f2f; font-size: 1.1rem; display: block;">OS: ${res.os || '---'}</strong>
                    <strong style="font-size: 1rem; color: #333;">${res.lente}</strong><br>
                    <small style="color: #666;">${res.dataHora}</small>
                    ${ehAdmin ? `<br><small style="color:#1976d2;"><b>Vendedor:</b> ${res.usuario}</small>` : ''}
                </div>
                <span style="background: ${corStatus}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: bold;">${status}</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="grid-column: 1 / 3; background: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #1565c0; border-left: 3px solid #1565c0;">OLHO DIREITO</div>
                <div style="background: #f8f9fa; border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
                    <small style="display:block; color:#666; font-size:9px;">ESF</small>
                    <span style="font-weight: bold; font-size: 14px;">${res.esfOD}</span>
                </div>
                <div style="background: #f8f9fa; border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
                    <small style="display:block; color:#666; font-size:9px;">CIL</small>
                    <span style="font-weight: bold; font-size: 14px;">${res.cilOD}</span>
                </div>

                <div style="grid-column: 1 / 3; background: #fff1f1; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #c62828; border-left: 3px solid #c62828; margin-top: 5px;">OLHO ESQUERDO</div>
                <div style="background: #f8f9fa; border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
                    <small style="display:block; color:#666; font-size:9px;">ESF</small>
                    <span style="font-weight: bold; font-size: 14px;">${res.esfOE}</span>
                </div>
                <div style="background: #f8f9fa; border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
                    <small style="display:block; color:#666; font-size:9px;">CIL</small>
                    <span style="font-weight: bold; font-size: 14px;">${res.cilOE}</span>
                </div>
            </div>

            ${status === "AGUARDANDO" ? `
                <div style="margin-top: 15px;">
                    ${ehAdmin ? 
                        `<button onclick="confirmarBaixa(${res.idLinha})" style="width:100%; background:#2e7d32; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">CONCLUIR SAÍDA</button>` : 
                        `<button onclick="cancelarReservaHistorico(${res.idLinha})" style="width:100%; background:#fff; color:#d32f2f; border:1px solid #d32f2f; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;">CANCELAR RESERVA</button>`
                    }
                </div>
            ` : ''}
        </div>
    `;
}

// --- 5. ACÕES ADICIONAIS ---

async function confirmarBaixa(id) {
    if(!confirm("Confirmar a saída desta lente?")) return;
    try {
        const res = await fetch(`${URL_API}?action=confirmarBaixaEstoque&id=${id}`);
        if((await res.json()).status === "success") {
            alert("Baixa realizada!");
            buscarHistoricoReservas();
            verificarNotificacoes();
        }
    } catch (e) { alert("Erro ao processar."); }
}

async function cancelarReservaHistorico(id) {
    if(!confirm("Cancelar esta reserva?")) return;
    try {
        const res = await fetch(`${URL_API}?action=cancelarReserva&id=${id}`);
        if((await res.json()).status === "success") {
            alert("Reserva cancelada!");
            buscarHistoricoReservas();
            verificarNotificacoes();
        }
    } catch (e) { alert("Erro ao cancelar."); }
}

// --- 6. BALANÇO MANUAL ---

function abrirBalanco() {
    document.getElementById("modalBalanco").style.display = "flex";
    buscarQtdBalanco();
}

function fecharBalanco() {
    document.getElementById("modalBalanco").style.display = "none";
}

function mudarAbaBalanco(btnClicado, abaNome) {
    abaAtualBalanco = abaNome;
    document.querySelectorAll('.aba-selector button').forEach(btn => btn.classList.remove('active'));
    btnClicado.classList.add('active');
    buscarQtdBalanco();
}

async function buscarQtdBalanco() {
    const esf = document.getElementById("esfBalanco").value;
    const cil = document.getElementById("cilBalanco").value;
    const inputQtd = document.getElementById("qtdEstoque");
    if (!inputQtd) return;
    inputQtd.value = "...";
    try {
        const res = await fetch(`${URL_API}?esf=${encodeURIComponent(esf)}&cil=${encodeURIComponent(cil)}`);
        const data = await res.json();
        inputQtd.value = (data.estoque_por_aba && data.estoque_por_aba[abaAtualBalanco] !== undefined) ? data.estoque_por_aba[abaAtualBalanco] : 0;
    } catch (e) { inputQtd.value = 0; }
}

function ajustarQtd(valor) {
    const input = document.getElementById("qtdEstoque");
    let atual = parseInt(input.value) || 0;
    if (atual + valor >= 0) input.value = atual + valor;
}

async function salvarEstoqueManual() {
    const esf = document.getElementById("esfBalanco").value;
    const cil = document.getElementById("cilBalanco").value;
    const qtd = document.getElementById("qtdEstoque").value;
    const btnSalvar = document.querySelector(".btn-salvar");
    
    btnSalvar.innerText = "SALVANDO...";
    btnSalvar.disabled = true;

    const url = `${URL_API}?action=updateStock&esf=${encodeURIComponent(esf)}&cil=${encodeURIComponent(cil)}&tipo=${encodeURIComponent(abaAtualBalanco)}&quantidade=${qtd}`;
    try {
        const res = await fetch(url);
        if ((await res.json()).status === "success") alert("Estoque atualizado!");
    } catch (e) { alert("Erro ao salvar."); } finally {
        btnSalvar.innerText = "SALVAR ALTERAÇÃO";
        btnSalvar.disabled = false;
        buscarQtdBalanco(); 
    }
}

window.onclick = function(event) {
    if (event.target == document.getElementById("modalBalanco")) fecharBalanco();
    if (event.target == document.getElementById("modalHistorico")) fecharHistorico();
}