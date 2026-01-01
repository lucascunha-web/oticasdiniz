document.addEventListener('DOMContentLoaded', () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const vendasGerais = JSON.parse(sessionStorage.getItem("vendas"));
    const linksCardapio = JSON.parse(sessionStorage.getItem("cardapios"));

    if (!usuario) { window.location.href = "index.html"; return; }
    
    document.getElementById("nomeUsuario").innerText = usuario.nome;
    const nomeBusca = usuario.nome.toUpperCase().trim();
    const nivelUsuario = usuario.nivel ? usuario.nivel.toLowerCase().trim() : "";

    // ============================================================
    // --- CONTROLE DE ACESSO ---
    // ============================================================
    const btnBalanco = document.querySelector('.btn-balanco');
    const filtroAdmin = document.getElementById("filtroAdminRanking");

    if (nivelUsuario !== "vendedor") {
        if (btnBalanco) btnBalanco.setAttribute('style', 'display: inline-flex !important');
    } else {
        if (btnBalanco) btnBalanco.remove();
    }

    if (nivelUsuario === "admin") {
        if (filtroAdmin) filtroAdmin.style.display = "block";
    } else {
        if (filtroAdmin) filtroAdmin.remove();
    }

    if (nivelUsuario === "vendedor") {
        const areaInd = document.getElementById("areaIndicadores");
        if(areaInd) areaInd.style.display = "grid";
        carregarMeusIndicadores(vendasGerais, nomeBusca);
    }

    // ============================================================
    // --- INICIALIZAÇÃO ---
    // ============================================================
    gerarRanking(vendasGerais, 'faturamento', nomeBusca);
    popularEscalas();

    if (linksCardapio) {
        linksCardapio.forEach(item => {
            const marcaID = item.marca.toUpperCase().trim().replace(/\s/g, '');
            const element = document.getElementById(`link-${marcaID}`);
            if (element) element.href = item.link;
        });
    }

    // Navegação entre abas
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id === 'btnTabelas') return;
            e.preventDefault();
            const target = link.getAttribute('data-target');
            if(!target) return;

            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            link.classList.add('active');
            document.getElementById(target).classList.add('active');

            // Carrega comunicados via API externa ao clicar na aba
            if(target === 'aba-comunicados') carregarComunicados();
        });
    });
});

// ============================================================
// --- COMUNICADOS (VIA API EXTERNA) ---
// ============================================================
async function carregarComunicados() {
    const lista = document.getElementById("listaComunicados");
    if(!lista) return;

    lista.innerHTML = "<p style='text-align:center; padding:20px;'>Carregando comunicados...</p>";

    const URL_API_COMUNICADOS = "https://script.google.com/macros/s/AKfycbxBtChCeNfo9y7x-8M1f0J8ByG1FnKAMjqcaUhUF92Y1gIpjnLk0d_3HDwrl3S3XpTE/exec?action=manageComunicados&subAction=list";

    try {
        const response = await fetch(URL_API_COMUNICADOS);
        const data = await response.json();

        if (data.status === "success" && data.comunicados.length > 0) {
            lista.innerHTML = data.comunicados.map(c => `
                <div class="comunicado-card" style="background:#fff; padding:15px; border-radius:10px; margin-bottom:12px; border-left:5px solid #B71C1C; box-shadow:0 2px 5px rgba(0,0,0,0.1)">
                    <h4 style="color:#B71C1C; margin:0 0 5px 0">${c.titulo}</h4>
                    <div style="margin-bottom:10px;">
                         <a href="${c.url}" target="_blank" style="color:#007bff; text-decoration:none; font-size:14px;">
                            <i class="fas fa-external-link-alt"></i> Clique para abrir o comunicado
                         </a>
                    </div>
                    <small style="color:#999; font-size:11px;">Publicado em: ${c.data}</small>
                </div>
            `).join('');
        } else {
            lista.innerHTML = "<p style='text-align:center; padding:20px;'>Nenhum comunicado ativo.</p>";
        }
    } catch (error) {
        lista.innerHTML = "<p style='text-align:center; padding:20px; color:red;'>Erro ao carregar comunicados.</p>";
        console.error("Erro comunicados:", error);
    }
}

// ============================================================
// --- FUNÇÕES DE BALANÇO ---
// ============================================================
function abrirBalanco() { 
    const modal = document.getElementById("modalBalanco");
    if(modal) modal.style.display = "flex"; 
}

function fecharBalanco() { 
    const modal = document.getElementById("modalBalanco");
    if(modal) modal.style.display = "none"; 
}

function ajustarQtd(valor) {
    const input = document.getElementById("qtdEstoque");
    if(!input) return;
    let novo = (parseInt(input.value) || 0) + valor;
    input.value = novo < 0 ? 0 : novo;
}

// ============================================================
// --- RANKING (LÓGICA ORIGINAL PRESERVADA) ---
// ============================================================
const parseNum = (val) => {
    if (!val) return 0;
    let s = val.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').replace('%', '').trim();
    return parseFloat(s) || 0;
};

function carregarMeusIndicadores(vendasGerais, nomeBusca) {
    if(!vendasGerais) return;
    const meusDados = vendasGerais.find(v => v.usuario === nomeBusca);
    if (meusDados) {
        document.getElementById("totalFaturamento").innerText = meusDados.faturamento;
        document.getElementById("totalVendas").innerText = meusDados.vendas;
        document.getElementById("ticketMedio").innerText = meusDados.ticket;
        document.getElementById("totalDesconto").innerText = meusDados.desconto + "%";

        document.getElementById("rankFaturamento").innerText = `#${getPosicaoRanking(vendasGerais, 'faturamento', nomeBusca)}º`;
        document.getElementById("rankTicket").innerText = `#${getPosicaoRanking(vendasGerais, 'ticket', nomeBusca)}º`;
        document.getElementById("rankVendas").innerText = `#${getPosicaoRanking(vendasGerais, 'vendas', nomeBusca)}º`;
        document.getElementById("rankDesconto").innerText = `#${getPosicaoRanking(vendasGerais, 'desconto', nomeBusca, true)}º`;
    }
}

function getPosicaoRanking(vendas, campo, nomeBusca, inverter = false) {
    let ordenada = [...vendas].sort((a, b) => {
        let vA = parseNum(a[campo]);
        let vB = parseNum(b[campo]);
        return inverter ? vA - vB : vB - vA;
    });
    return ordenada.findIndex(v => v.usuario === nomeBusca) + 1;
}

function atualizarRankingPorFiltro() {
    const indicador = document.getElementById("selectIndicador").value;
    const vendasGerais = JSON.parse(sessionStorage.getItem("vendas"));
    const usuario = JSON.parse(sessionStorage.getItem("usuarioLogado"));
    const nomeBusca = usuario.nome.toUpperCase().trim();
    const titulos = {'faturamento': 'Ranking de Faturamento','ticket': 'Ranking de Ticket Médio','vendas': 'Ranking de Vendas','desconto': 'Ranking de Desconto'};
    document.getElementById("tituloRanking").innerText = titulos[indicador];
    gerarRanking(vendasGerais, indicador, nomeBusca, (indicador === 'desconto'));
}

function gerarRanking(vendas, campo, nomeBusca, inverter = false) {
    const container = document.getElementById("rankingContainer");
    if (!container || !vendas) return;

    const fullRanking = [...vendas].sort((a, b) => {
        let vA = parseNum(a[campo]);
        let vB = parseNum(b[campo]);
        return inverter ? vA - vB : vB - vA;
    });

    const maxValorParaBarra = Math.max(...vendas.map(v => parseNum(v[campo]))) || 1;

    container.innerHTML = "";
    fullRanking.forEach((v, i) => {
        const pos = i + 1;
        const perc = (parseNum(v[campo]) / maxValorParaBarra) * 100;
        const isMe = v.usuario === nomeBusca;
        let medal = pos === 1 ? "🥇" : (pos === 2 ? "🥈" : (pos === 3 ? "🥉" : pos + "º"));

        container.innerHTML += `
            <div class="ranking-item ${pos <= 3 ? 'rank-'+pos : 'rank-others'} ${isMe ? 'is-me' : ''}">
                <div class="rank-label">
                    <span>${medal} ${v.usuario} ${isMe ? '<strong>(VOCÊ)</strong>' : ''}</span>
                    <span>${v[campo]}${campo === 'desconto' ? '%' : ''}</span>
                </div>
                <div class="progress-bg"><div class="progress-bar" style="width: ${perc}%"></div></div>
            </div>`;
    });
}

// ============================================================
// --- TABELAS E CALCULADORA (ORIGINAIS) ---
// ============================================================
function toggleTabelas(e) {
    e.preventDefault();
    const submenu = document.getElementById("submenuTabelas");
    const chevron = e.currentTarget.querySelector(".fa-chevron-down");
    submenu.style.display = (submenu.style.display === "flex") ? "none" : "flex";
    if(chevron) chevron.style.transform = (submenu.style.display === "flex") ? "rotate(180deg)" : "rotate(0deg)";
}

function popularEscalas() {
    const gerar = (min, max) => {
        let options = "";
        for (let i = min; i <= max; i += 0.25) {
            let v = i.toFixed(2);
            options += `<option value="${v}">${i > 0 ? "+" + v : v}</option>`;
        }
        return options;
    };
    const esf = gerar(-10, 10);
    const cilNeg = gerar(-6, 0);
    const cilPos = gerar(0, 6);
    const add = gerar(0, 4);
    let eixo = "";
    for(let i=0; i<=180; i++) eixo += `<option value="${i}">${i}°</option>`;

    const IDs = ["pEsfOd","pEsfOe","pCilOd","pCilOe","pAddOd","pAddOe","aLongeEsfOd","aLongeEsfOe","aLongeCilOd","aLongeCilOe","aPertoEsfOd","aPertoEsfOe","aPertoCilOd","aPertoCilOe","tEsfOd","tEsfOe","tCilOd","tCilOe","tEixoOd","tEixoOe"];
    
    IDs.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if(id.includes("Esf")) el.innerHTML = esf;
        else if(id.includes("Cil")) el.innerHTML = id.startsWith('t') ? cilPos : cilNeg;
        else if(id.includes("Add")) el.innerHTML = add;
        else if(id.includes("Eixo")) el.innerHTML = eixo;
    });
}

function switchCalcTab(event, tabId) {
    document.querySelectorAll('.calc-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.calc-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

function calcularPerto() {
    const od = parseFloat(document.getElementById("pEsfOd").value) + parseFloat(document.getElementById("pAddOd").value);
    const oe = parseFloat(document.getElementById("pEsfOe").value) + parseFloat(document.getElementById("pAddOe").value);
    const res = document.getElementById("resPerto");
    res.style.display = "block";
    res.innerHTML = `
        <div style="text-align:center; font-weight:900; font-size:12px; margin-bottom:15px">RESULTADO PERTO</div>
        <div class="res-row">
            <span style="color:#B71C1C; font-weight:900; width:30px">OD</span>
            <div class="res-item"><label>ESF</label><div class="res-val">${od > 0 ? '+'+od.toFixed(2) : od.toFixed(2)}</div></div>
            <div class="res-item"><label>CIL</label><div class="res-val">${document.getElementById("pCilOd").value}</div></div>
        </div>
        <div class="res-row">
            <span style="color:#B71C1C; font-weight:900; width:30px">OE</span>
            <div class="res-item"><label>ESF</label><div class="res-val">${oe > 0 ? '+'+oe.toFixed(2) : oe.toFixed(2)}</div></div>
            <div class="res-item"><label>CIL</label><div class="res-val">${document.getElementById("pCilOe").value}</div></div>
        </div>`;
}

function calcularAdicao() {
    const od = parseFloat(document.getElementById("aPertoEsfOd").value) - parseFloat(document.getElementById("aLongeEsfOd").value);
    const oe = parseFloat(document.getElementById("aPertoEsfOe").value) - parseFloat(document.getElementById("aLongeEsfOe").value);
    const res = document.getElementById("resAdicao");
    res.style.display = "block";
    res.innerHTML = `
        <div style="text-align:center; font-weight:900; font-size:12px; margin-bottom:15px">VALOR DE ADIÇÃO</div>
        <div class="res-row">
            <div class="res-item"><label>OD</label><div class="res-val">${od > 0 ? '+'+od.toFixed(2) : od.toFixed(2)}</div></div>
            <div class="res-item"><label>OE</label><div class="res-val">${oe > 0 ? '+'+oe.toFixed(2) : oe.toFixed(2)}</div></div>
        </div>`;
}

function calcularTransp() {
    const t = (eId, cId, exId) => {
        let e = parseFloat(document.getElementById(eId).value), c = parseFloat(document.getElementById(cId).value), ex = parseInt(document.getElementById(exId).value);
        return { esf: e + c, cil: c * -1, eixo: ex <= 90 ? ex + 90 : ex - 90 };
    };
    const od = t("tEsfOd", "tCilOd", "tEixoOd"), oe = t("tEsfOe", "tCilOe", "tEixoOe");
    const res = document.getElementById("resTransp");
    res.style.display = "block";
    res.innerHTML = `
        <div style="text-align:center; font-weight:900; font-size:12px; margin-bottom:15px">TRANSPOSIÇÃO NEGATIVA</div>
        <div class="res-row">
             <span style="color:#B71C1C; font-weight:900; width:30px">OD</span>
             <div class="res-item"><label>ESF</label><div class="res-val">${od.esf > 0 ? '+'+od.esf.toFixed(2) : od.esf.toFixed(2)}</div></div>
             <div class="res-item"><label>CIL</label><div class="res-val">${od.cil.toFixed(2)}</div></div>
             <div class="res-item"><label>EIXO</label><div class="res-val">${od.eixo}°</div></div>
        </div>
        <div class="res-row" style="margin-top:20px">
             <span style="color:#B71C1C; font-weight:900; width:30px">OE</span>
             <div class="res-item"><label>ESF</label><div class="res-val">${oe.esf > 0 ? '+'+oe.esf.toFixed(2) : oe.esf.toFixed(2)}</div></div>
             <div class="res-item"><label>CIL</label><div class="res-val">${oe.cil.toFixed(2)}</div></div>
             <div class="res-item"><label>EIXO</label><div class="res-val">${oe.eixo}°</div></div>
        </div>`;
}

function logout() { sessionStorage.clear(); window.location.href = "index.html"; }