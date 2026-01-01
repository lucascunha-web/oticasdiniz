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

    if (btnBalanco && user && user.nivel) {
    const nivel = user.nivel.toLowerCase().trim();
    if (nivel === "admin" || nivel === "estoquista") {
        btnBalanco.style.setProperty("display", "flex", "important"); // Força a aparição
        console.log("Botão Balanço liberado para:", nivel);
    } else {
        btnBalanco.style.display = "none";
        console.log("Acesso negado ao balanço para nível:", nivel);
    }
} else {
    console.warn("Usuário não logado ou botão não encontrado no HTML");
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

// --- 2. LÓGICA DE CONSULTA (VENDEDOR) ---

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
        // Chamadas usando a nova estrutura de resposta do servidor
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
            // Garantindo que pegamos o valor correto do objeto estoque_por_aba
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
        console.error(e);
        container.innerHTML = `<p style="grid-column: 1/-1; color:red; text-align:center;">Erro ao conectar com o servidor.</p>`;
    } finally {
        btn.innerText = "CONSULTAR";
        btn.disabled = false;
    }
}

async function reservar(lente) {
    const user = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const dataHora = new Date().toLocaleString('pt-BR');
    
    const esfOD = document.getElementById('esfOD').value;
    const cilOD = document.getElementById('cilOD').value;
    const esfOE = document.getElementById('esfOE').value;
    const cilOE = document.getElementById('cilOE').value;

    const url = `${URL_API}?action=reservar&usuario=${encodeURIComponent(user.nome)}&dataHora=${encodeURIComponent(dataHora)}&esfOD=${encodeURIComponent(esfOD)}&cilOD=${encodeURIComponent(cilOD)}&esfOE=${encodeURIComponent(esfOE)}&cilOE=${encodeURIComponent(cilOE)}&lente=${encodeURIComponent(lente)}`;

    if (confirm(`Confirmar reserva de ${lente} para este grau??`)) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === "success") {
                alert("Reserva enviada com sucesso!");
                consultarEstoque();
            }
        } catch (e) {
            alert("Erro ao processar reserva.");
        }
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
    document.querySelectorAll('.aba-selector button').forEach(btn => {
        btn.classList.remove('active');
    });
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
        
        if (data.estoque_por_aba && data.estoque_por_aba[abaAtualBalanco] !== undefined) {
            inputQtd.value = data.estoque_por_aba[abaAtualBalanco];
        } else {
            inputQtd.value = 0;
        }
    } catch (e) {
        inputQtd.value = 0;
    }
}

function ajustarQtd(valor) {
    const input = document.getElementById("qtdEstoque");
    let atual = parseInt(input.value) || 0;
    if (atual + valor >= 0) {
        input.value = atual + valor;
    }
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
        if (data.status === "success") {
            alert("Estoque atualizado na planilha!");
        } else {
            alert("Erro ao salvar: " + (data.message || "Erro desconhecido"));
        }
    } catch (e) {
        alert("Erro de conexão.");
    } finally {
        btnSalvar.innerText = "SALVAR ALTERAÇÃO";
        btnSalvar.disabled = false;
        buscarQtdBalanco(); 
    }
}

window.onclick = function(event) {
    const modal = document.getElementById("modalBalanco");
    if (event.target == modal) fecharBalanco();
}