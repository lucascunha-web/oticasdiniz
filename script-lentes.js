const URL_API = "https://script.google.com/macros/s/AKfycbwF0o33iHkqxy11BqzFXHUPeY_2iWj1HfiMc9AWIyOYnugY_whUazaIP7q7vBhNU8-_/exec";
let abaAtualBalanco = 'ACRILICA AR';

document.addEventListener('DOMContentLoaded', () => {
    popularSelects();
    
    const esfBal = document.getElementById("esfBalanco");
    const cilBal = document.getElementById("cilBalanco");
    if(esfBal) esfBal.addEventListener('change', buscarQtdBalanco);
    if(cilBal) cilBal.addEventListener('change', buscarQtdBalanco);

    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const btnBalanco = document.querySelector(".btn-balanco");
    const btnHistorico = document.querySelector(".btn-historico");

    if (user && user.nivel) {
        const nivel = user.nivel.toLowerCase().trim();
        
        if (btnHistorico) btnHistorico.addEventListener('click', abrirHistorico);

        if (btnBalanco) {
            if (nivel === "admin" || nivel === "estoquista") {
                btnBalanco.style.setProperty("display", "flex", "important");
            } else {
                btnBalanco.style.display = "none";
            }
        }
    }
});

// --- 1. CONFIGURAÇÃO INICIAL ---

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

// --- 2. LÓGICA DE CONSULTA E RESERVA ---

async function consultarEstoque() {
    const btn = document.getElementById("btnConsultar");
    const container = document.getElementById("resultadosLentes");
    
    const esfOD = document.getElementById('esfOD').value;
    const cilOD = document.getElementById('cilOD').value;
    const esfOE = document.getElementById('esfOE').value;
    const cilOE = document.getElementById('cilOE').value;

    btn.innerText = "CARREGANDO...";
    btn.disabled = true;
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px;">
        <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: #ddd;"></i>
        <p style="margin-top:10px; color:#666;">Consultando estoque...</p>
    </div>`;

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
        container.innerHTML = `<p style="grid-column: 1/-1; color:red; text-align:center;">Erro ao conectar com o servidor.</p>`;
    } finally {
        btn.innerText = "CONSULTAR";
        btn.disabled = false;
    }
}

async function reservar(lente) {
    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const dataISO = new Date().toISOString(); // Enviamos ISO para o banco para evitar erros
    const esfOD = document.getElementById('esfOD').value;
    const cilOD = document.getElementById('cilOD').value;
    const esfOE = document.getElementById('esfOE').value;
    const cilOE = document.getElementById('cilOE').value;

    const url = `${URL_API}?action=reservar&usuario=${encodeURIComponent(user.nome)}&dataHora=${encodeURIComponent(dataISO)}&esfOD=${encodeURIComponent(esfOD)}&cilOD=${encodeURIComponent(cilOD)}&esfOE=${encodeURIComponent(esfOE)}&cilOE=${encodeURIComponent(cilOE)}&lente=${encodeURIComponent(lente)}`;

    if (confirm(`Confirmar reserva de ${lente} para este grau?`)) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === "success") {
                alert("Reserva enviada com sucesso!");
                consultarEstoque();
            }
        } catch (e) { alert("Erro ao processar reserva."); }
    }
}

// --- 3. LÓGICA DO BALANÇO ---

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
        const data = await res.json();
        if (data.status === "success") alert("Estoque atualizado na planilha!");
        else alert("Erro ao salvar: " + (data.message || "Erro desconhecido"));
    } catch (e) { alert("Erro de conexão."); } finally {
        btnSalvar.innerText = "SALVAR ALTERAÇÃO";
        btnSalvar.disabled = false;
        buscarQtdBalanco(); 
    }
}

// --- 4. LÓGICA DO HISTÓRICO (CORREÇÃO GRID E DATA) ---

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
    
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>`;

    try {
        const nivel = user.nivel.toLowerCase().trim();
        const ehAdmin = (nivel === "admin" || nivel === "estoquista");
        const usuarioBusca = ehAdmin ? "ADMIN" : user.nome;

        const res = await fetch(`${URL_API}?action=getHistory&usuario=${encodeURIComponent(usuarioBusca)}`);
        const reservas = await res.json();

        container.innerHTML = "";
        if (reservas.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:#666;">Nenhuma reserva encontrada.</p>`;
            return;
        }

        reservas.forEach(reserva => {
            const status = (reserva.status || "AGUARDANDO").toUpperCase();
            if (ehAdmin && status !== "AGUARDANDO") return;
            container.innerHTML += renderizarCardHistorico(reserva, ehAdmin);
        });
    } catch (e) {
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Erro ao carregar dados.</p>`;
    }
}

function renderizarCardHistorico(res, ehAdmin) {
    const status = (res.status || "AGUARDANDO").toUpperCase();
    const corStatus = status === 'RESERVADO' ? '#2e7d32' : status === 'CANCELADO' ? '#d32f2f' : '#1976d2';
    
    // Agora a data já vem como texto formatado do getDisplayValues
    const dataExibicao = res.dataHora;

    return `
        <div class="card-historico" style="border-left: 5px solid ${corStatus}; margin-bottom: 12px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05)">
            <div class="reserva-topo" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="reserva-info-lente">
                    <strong style="font-size: 1.1rem; display: block; color: #333;">${res.lente}</strong>
                    <small style="color: #666; font-size: 12px; font-weight: bold;">${dataExibicao}</small>
                    ${ehAdmin ? `<br><small style="color:#1976d2;"><b>Vendedor:</b> ${res.usuario}</small>` : ''}
                </div>
                <span style="background: ${corStatus}15; color: ${corStatus}; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 900;">
                    ${status}
                </span>
            </div>
            
            <div class="reserva-graus-box" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                <div style="background: #f8f9fa; border: 1px solid #eee; padding: 6px; border-radius: 4px; text-align: center;">
                    <b style="display:block; font-size: 10px; color: #1976d2;">OD ESF</b>
                    <span style="font-weight: bold; font-size: 14px;">${res.esfOD}</span>
                </div>
                <div style="background: #f8f9fa; border: 1px solid #eee; padding: 6px; border-radius: 4px; text-align: center;">
                    <b style="display:block; font-size: 10px; color: #1976d2;">OD CIL</b>
                    <span style="font-weight: bold; font-size: 14px;">${res.cilOD}</span>
                </div>
                <div style="background: #f8f9fa; border: 1px solid #eee; padding: 6px; border-radius: 4px; text-align: center;">
                    <b style="display:block; font-size: 10px; color: #1976d2;">OE ESF</b>
                    <span style="font-weight: bold; font-size: 14px;">${res.esfOE}</span>
                </div>
                <div style="background: #f8f9fa; border: 1px solid #eee; padding: 6px; border-radius: 4px; text-align: center;">
                    <b style="display:block; font-size: 10px; color: #1976d2;">OE CIL</b>
                    <span style="font-weight: bold; font-size: 14px;">${res.oeCil || res.cilOE}</span>
                </div>
            </div>

            ${status === "AGUARDANDO" ? `
                <div style="margin-top: 15px;">
                    ${ehAdmin ? 
                        `<button onclick="confirmarBaixa(${res.idLinha})" style="width:100%; background:#2e7d32; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; text-transform: uppercase;">Baixar Estoque</button>` : 
                        `<button onclick="cancelarReservaHistorico(${res.idLinha})" style="width:100%; background:#fff; color:#d32f2f; border:1px solid #d32f2f; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;">CANCELAR RESERVA</button>`
                    }
                </div>
            ` : ''}
        </div>
    `;
}

async function confirmarBaixa(id) {
    if(!confirm("Deseja confirmar a saída desta lente e atualizar o estoque?")) return;
    try {
        const res = await fetch(`${URL_API}?action=confirmarBaixaEstoque&id=${id}`);
        const data = await res.json();
        if(data.status === "success") {
            alert("Baixa realizada!");
            buscarHistoricoReservas();
        } else { alert("Erro: " + data.message); }
    } catch (e) { alert("Erro ao processar baixa."); }
}

async function cancelarReservaHistorico(id) {
    if(!confirm("Deseja realmente cancelar sua reserva?")) return;
    try {
        const res = await fetch(`${URL_API}?action=cancelarReserva&id=${id}`);
        const data = await res.json();
        if(data.status === "success") {
            alert("Reserva cancelada!");
            buscarHistoricoReservas();
        }
    } catch (e) { alert("Erro ao cancelar."); }
}

window.onclick = function(event) {
    const modalBalanco = document.getElementById("modalBalanco");
    const modalHistorico = document.getElementById("modalHistorico");
    if (event.target == modalBalanco) fecharBalanco();
    if (event.target == modalHistorico) fecharHistorico();
}