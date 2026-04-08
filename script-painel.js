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
    const btnDashboard = document.getElementById('nav-dashboard');

    if (nivelUsuario !== "vendedor") {
        if (btnBalanco) btnBalanco.setAttribute('style', 'display: inline-flex !important');
    } else {
        if (btnBalanco) btnBalanco.remove();
    }

    if (nivelUsuario === "admin" || nivelUsuario === "gerente") {
        if (filtroAdmin) filtroAdmin.style.display = "block";
    } else {
        if (filtroAdmin) filtroAdmin.remove();
    }

    if (nivelUsuario === "vendedor") {
        const areaInd = document.getElementById("areaIndicadores");
        if(areaInd) areaInd.style.display = "grid";
        carregarMeusIndicadores(vendasGerais, nomeBusca);
    }

    if (nivelUsuario !== "admin") {
        if (btnDashboard) {
                btnDashboard.style.setProperty('display', 'none', 'important');
            }
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

// Função atualizada para carregar os indicadores, incluindo o número de avaliações
function carregarMeusIndicadores(vendasGerais, nomeBusca) {
    if(!vendasGerais) return;
    const meusDados = vendasGerais.find(v => v.usuario === nomeBusca);
    
    if (meusDados) {
        document.getElementById("totalFaturamento").innerText = meusDados.faturamento;
        document.getElementById("totalVendas").innerText = meusDados.vendas;
        document.getElementById("ticketMedio").innerText = meusDados.ticket;
        document.getElementById("totalDesconto").innerText = meusDados.desconto + "%";

        const faturamentoReal = parseNum(meusDados.faturamento);
        const metaParaAtivar = parseNum(meusDados.ativar_meta); // Novo campo da Coluna G
        const elementStatus2 = document.getElementById("statusComissao");

        if(elementStatus2) {
            // Se o faturamento for maior ou igual ao valor da Coluna G (P.E.)
            if (faturamentoReal >= metaParaAtivar && metaParaAtivar > 0) {
                elementStatus2.innerText = "COMISSÃO ATIVADA";
                elementStatus2.className = "comissao-ativa";
            } else {
                elementStatus2.innerText = "COMISSÃO INATIVA";
                elementStatus2.className = "comissao-inativa";
            }
        }

        // --- LÓGICA DE AVALIAÇÕES E COMISSÃO ---
        const valorAvaliacoes = parseNum(meusDados.avaliacoes); // Usa sua função parseNum
        const elementAvaliacoe = document.getElementById("totalAvaliacoes");
        const elementStatus = document.getElementById("statusComissao");

        if(elementAvaliacoe) {
            elementAvaliacoe.innerText = meusDados.avaliacoes || "0";
        }

        if(elementStatus) {
            if (valorAvaliacoes >= 10) {
        elementStatus.innerText = "COMISSÃO ATIVADA"; // Palavra curta
        elementStatus.className = "comissao-ativa";} 
        else {
        elementStatus.innerText = "COMISSÃO INATIVA"; // Palavra curta
        elementStatus.className = "comissao-inativa";
    }
}
        
        // Exibe a nota de avaliações como número (Coluna F da planilha)
        const elementAvaliacoes = document.getElementById("totalAvaliacoes");
        if(elementAvaliacoes) {
            elementAvaliacoes.innerText = meusDados.avaliacoes || "0.0";
        }
        const rankAval = document.getElementById("rankAvaliacoes");
        if(rankAval) {
            rankAval.innerText = `#${getPosicaoRanking(vendasGerais, 'avaliacoes', nomeBusca)}º`;
        }

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
    const titulos = {'faturamento': 'Ranking de Faturamento','ticket': 'Ranking de Ticket Médio','vendas': 'Ranking de Vendas','desconto': 'Ranking de Desconto', 'avaliacoes': 'Ranking de Avaliações'};
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

        // Lógica para a Badge de comissão no ranking
        let badgeComissaoHtml = "";
        if (campo === 'faturamento') {
            const faturado = parseNum(v.faturamento);
            const meta = parseNum(v.ativar_meta);
            const ativa = (faturado >= meta && meta > 0);
            
            badgeComissaoHtml = ativa 
                ? `<span style="font-size: 0.65rem; background: #2ecc71; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 10px;">COMISSÃO ATIVADA</span>`
                : `<span style="font-size: 0.65rem; background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 10px;">COMISSÃO NÃO ATIVADA</span>`;
        }

// ... (código anterior da função se mantém)

container.innerHTML += `
            <div class="ranking-item ${pos <= 3 ? 'rank-'+pos : 'rank-others'} ${isMe ? 'is-me' : ''}">
                <div class="rank-label" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    
                    <div style="display: flex; align-items: center;">
                        <span>${medal} ${v.usuario} ${isMe ? '<strong>(VOCÊ)</strong>' : ''}</span>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        <span style="font-weight: bold; font-size: 0.95rem;">
                            ${v[campo]}${campo === 'desconto' ? '%' : ''}
                        </span>
                        ${badgeComissaoHtml}
                    </div>

                </div>
                <div class="progress-bg">
                    <div class="progress-bar" style="width: ${perc}%"></div>
                </div>
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

// --- 1. INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    popularEscalas();
    configurarReplicacao();
});

// Controle de Abas
function switchCalcTab(event, tabId) {
    const contents = document.querySelectorAll('.calc-tab-content');
    contents.forEach(c => c.classList.remove('active'));
    const tabs = document.querySelectorAll('.calc-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- 2. POPULAR CAMPOS (Garante que os números apareçam) ---
function popularEscalas() {
    const gerar = (min, max) => {
        let options = "";
        for (let i = min; i <= max; i += 0.25) {
            let v = i.toFixed(2);
            let label = i > 0 ? "+" + v : v;
            options += `<option value="${v}">${label}</option>`;
        }
        return options;
    };

    const esf = gerar(-10, 10);
    const cilNeg = gerar(-6, 0);
    const cilPos = gerar(0, 6);
    const add = gerar(0, 4);
    let eixo = "";
    for(let i=0; i<=180; i++) eixo += `<option value="${i}">${i}°</option>`;

    const IDs = [
        "pEsfOd","pEsfOe","pCilOd","pCilOe","pAddOd","pAddOe","pEixoOd","pEixoOe",
        "aLongeEsfOd","aLongeEsfOe","aLongeCilOd","aLongeCilOe","aLongeEixoOd","aLongeEixoOe",
        "aPertoEsfOd","aPertoEsfOe","aPertoCilOd","aPertoCilOe","aPertoEixoOd","aPertoEixoOe",
        "tEsfOd","tEsfOe","tCilOd","tCilOe","tEixoOd","tEixoOe",
        "esfOD", "cilOD", "esfOE", "cilOE", "esfBalanco", "cilBalanco"
    ];
    
    IDs.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if(id.includes("Esf") || id.includes("esf")) el.innerHTML = esf;
        else if(id.includes("Cil") || id.includes("cil")) el.innerHTML = id.startsWith('t') ? cilPos : cilNeg;
        else if(id.includes("Add")) el.innerHTML = add;
        else if(id.includes("Eixo")) el.innerHTML = eixo;
        el.value = id.includes("Eixo") ? "0" : "0.00";
    });
}

// --- 3. FUNÇÕES DE CÁLCULO (O CORAÇÃO DA CALCULADORA) ---
function calcularPerto() {
    const pegarTexto = (id) => {
        const el = document.getElementById(id);
        if (!el) return "--";
        return el.options[el.selectedIndex]?.text || "--";
    };

    const limpar = (t) => parseFloat(t.replace('+', '').replace('°', '')) || 0;

    // Dados OD
    const odEsf = pegarTexto("pEsfOd");
    const odCil = pegarTexto("pCilOd");
    const odEixo = pegarTexto("pEixoOd");
    const odAdd = pegarTexto("pAddOd");

    // Dados OE
    const oeEsf = pegarTexto("pEsfOe");
    const oeCil = pegarTexto("pCilOe");
    const oeEixo = pegarTexto("pEixoOe");
    const oeAdd = pegarTexto("pAddOe");

    // Cálculos
    const odFinal = (limpar(odEsf) + limpar(odAdd)).toFixed(2);
    const oeFinal = (limpar(oeEsf) + limpar(oeAdd)).toFixed(2);

    const formatar = (n) => n > 0 ? '+' + n : n;

    let html = `
        <div style="text-align:center; margin-bottom:20px;">
            <h3 style="color:#B71C1C; margin:0; font-size:1.2rem; text-transform:uppercase; letter-spacing:1px;">Receita de Perto Completa</h3>
            <div style="width:50px; hright:3px; background:#B71C1C; margin:8px auto; border-radius:10px;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-family: sans-serif;">
            
            <div style="grid-column: span 3; color: #666; font-size: 0.75rem; font-weight: bold; margin-top: 5px; display:flex; align-items:center;">
                OLHO DIREITO (OD) <div style="flex:1; height:1px; background:#eee; margin-left:10px;"></div>
            </div>
            
            <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">ESFÉRICO</span>
                <strong style="font-size:1.3rem; color:#2E7D32;">${formatar(odFinal)}</strong>
            </div>
            
            <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">CILÍNDRICO</span>
                <strong style="font-size:1.3rem; color:#333;">${odCil}</strong>
            </div>
            
            <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">EIXO</span>
                <strong style="font-size:1.3rem; color:#333;">${odEixo}</strong>
            </div>

            <div style="grid-column: span 3; color: #666; font-size: 0.75rem; font-weight: bold; margin-top: 15px; display:flex; align-items:center;">
                OLHO ESQUERDO (OE) <div style="flex:1; height:1px; background:#eee; margin-left:10px;"></div>
            </div>
            
            <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">ESFÉRICO</span>
                <strong style="font-size:1.3rem; color:#2E7D32;">${formatar(oeFinal)}</strong>
            </div>
            
            <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">CILÍNDRICO</span>
                <strong style="font-size:1.3rem; color:#333;">${oeCil}</strong>
            </div>
            
            <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">EIXO</span>
                <strong style="font-size:1.3rem; color:#333;">${oeEixo}</strong>
            </div>
        </div>
    `;

    exibirResultado("resPerto", html);
}
// --- 2. REPLICAÇÃO AUTOMÁTICA (OD e OE) ---
function configurarReplicacao() {
    const pares = [
        // Olho Direito
        { l: "aLongeCilOd", p: "aPertoCilOd" },
        { l: "aLongeEixoOd", p: "aPertoEixoOd" },
        // Olho Esquerdo (Adicionado agora)
        { l: "aLongeCilOe", p: "aPertoCilOe" },
        { l: "aLongeEixoOe", p: "aPertoEixoOe" }
    ];

    pares.forEach(pair => {
        const elLonge = document.getElementById(pair.l);
        const elPerto = document.getElementById(pair.p);
        if (elLonge && elPerto) {
            elLonge.addEventListener('change', () => {
                elPerto.value = elLonge.value;
            });
        }
    });
}

// --- 3. CÁLCULO DE ADIÇÃO (OD e OE) ---
function calcularAdicao() {
    const calcular = (pertoId, longeId) => {
        const p = document.getElementById(pertoId);
        const l = document.getElementById(longeId);
        return (p && l) ? (parseFloat(p.value) - parseFloat(l.value)).toFixed(2) : null;
    };

    const addOd = calcular("aPertoEsfOd", "aLongeEsfOd");
    const addOe = calcular("aPertoEsfOe", "aLongeEsfOe");

    let html = `<div style="text-align:center; font-weight:bold; margin-bottom:10px; color:#B71C1C">ADIÇÃO CALCULADA</div>`;
    
    html += `<div style="display:flex; justify-content:space-around; gap: 10px;">`;
    if (addOd !== null) {
        html += `<div style="background:#fff; padding:8px; border-radius:5px; flex:1; text-align:center">
                    <small>OD</small><br><b style="color:#2ecc71">${addOd > 0 ? '+' + addOd : addOd}</b>
                 </div>`;
    }
    if (addOe !== null) {
        html += `<div style="background:#fff; padding:8px; border-radius:5px; flex:1; text-align:center">
                    <small>OE</small><br><b style="color:#2ecc71">${addOe > 0 ? '+' + addOe : addOe}</b>
                 </div>`;
    }
    html += `</div>`;
    
    exibirResultado("resAdicao", html);
}

function calcularTransp() {
    // 1. Função de captura segura (lendo o texto visível)
    const pegarTexto = (id) => {
        const el = document.getElementById(id);
        if (!el) return "--";
        return el.options[el.selectedIndex]?.text || "--";
    };

    // 2. Função para converter o texto em número para a conta
    const limpar = (t) => parseFloat(t.replace('+', '').replace('°', '')) || 0;

    const transporOlho = (esfId, cilId, eixoId) => {
        const esfTxt = pegarTexto(esfId);
        const cilTxt = pegarTexto(cilId);
        const eixoTxt = pegarTexto(eixoId);

        if (esfTxt === "--") return null;

        let e = limpar(esfTxt);
        let c = limpar(cilTxt);
        let ex = limpar(eixoTxt);

        // A REGRA DA TRANSPOSIÇÃO:
        // Novo Esférico = Esférico + Cilíndrico
        // Novo Cilíndrico = Cilíndrico com sinal invertido
        // Novo Eixo = Se <= 90 soma 90, se > 90 subtrai 90
        let nEsf = (e + c).toFixed(2);
        let nCil = (c * -1).toFixed(2);
        let nEixo = ex <= 90 ? ex + 90 : ex - 90;

        return {
            esf: nEsf > 0 ? '+' + nEsf : nEsf,
            cil: nCil > 0 ? '+' + nCil : nCil,
            eixo: nEixo + "°"
        };
    };

    const od = transporOlho("tEsfOd", "tCilOd", "tEixoOd");
    const oe = transporOlho("tEsfOe", "tCilOe", "tEixoOe");

    let html = `
        <div style="text-align:center; margin-bottom:20px;">
            <h3 style="color:#B71C1C; margin:0; font-size:1.2rem; text-transform:uppercase; letter-spacing:1px;">Transposição Realizada</h3>
            <div style="width:50px; height:3px; background:#B71C1C; margin:8px auto; border-radius:10px;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            
            <div style="grid-column: span 3; color: #666; font-size: 0.75rem; font-weight: bold; margin-top: 5px; display:flex; align-items:center;">
                OLHO DIREITO (OD) <div style="flex:1; height:1px; background:#eee; margin-left:10px;"></div>
            </div>
            ${od ? `
                <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">NOVO ESF.</span>
                    <strong style="font-size:1.3rem; color:#2E7D32;">${od.esf}</strong>
                </div>
                <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">NOVO CIL.</span>
                    <strong style="font-size:1.3rem; color:#B71C1C;">${od.cil}</strong>
                </div>
                <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">NOVO EIXO</span>
                    <strong style="font-size:1.3rem; color:#333;">${od.eixo}</strong>
                </div>
            ` : '<div style="grid-column: span 3; text-align:center; color:#999;">Sem dados OD</div>'}

            <div style="grid-column: span 3; color: #666; font-size: 0.75rem; font-weight: bold; margin-top: 15px; display:flex; align-items:center;">
                OLHO ESQUERDO (OE) <div style="flex:1; height:1px; background:#eee; margin-left:10px;"></div>
            </div>
            ${oe ? `
                <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">NOVO ESF.</span>
                    <strong style="font-size:1.3rem; color:#2E7D32;">${oe.esf}</strong>
                </div>
                <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">NOVO CIL.</span>
                    <strong style="font-size:1.3rem; color:#B71C1C;">${oe.cil}</strong>
                </div>
                <div style="background:#fdfdfd; padding:15px 5px; border-radius:8px; text-align:center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <span style="display:block; color:#999; font-size:10px; font-weight:bold; margin-bottom:5px;">NOVO EIXO</span>
                    <strong style="font-size:1.3rem; color:#333;">${oe.eixo}</strong>
                </div>
            ` : '<div style="grid-column: span 3; text-align:center; color:#999;">Sem dados OE</div>'}
        </div>
    `;

    exibirResultado("resTransp", html);
}

// --- FUNÇÕES AUXILIARES ---
function exibirResultado(id, html) {
    const el = document.getElementById(id);
    if(el) {
        el.style.display = "block";
        el.style.marginTop = "15px";
        el.style.padding = "15px";
        el.style.background = "#f1f1f1";
        el.style.borderRadius = "8px";
        el.style.borderLeft = "5px solid #B71C1C";
        el.innerHTML = html;
    }
}

function handleReplication(event) {
    const longeId = event.target.id;
    // Mapeia o ID de longe para o de perto
    const pertoId = longeId.replace("Longe", "Perto");
    const elPerto = document.getElementById(pertoId);
    if (elPerto) {
        elPerto.value = event.target.value;
    }
}
// --- CONTROLE DE ABAS ---
function switchCalcTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("calc-tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }
    tablinks = document.getElementsByClassName("calc-tab-btn");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}
// ============================================================
// --- SISTEMA DE TREINAMENTOS ---
// ============================================================

function verModulo(moduloId) {
    const menu = document.getElementById('menuModulos');
    const area = document.getElementById('areaVideo');
    const listaAulas = document.getElementById('listaAulasModulo');
    const containerPlayer = document.getElementById('containerPlayer');
    const btnApostila = document.getElementById('btnApostila'); // Seleciona o novo botão

    if(!menu || !area || !listaAulas) return;

    // Reseta visualização
    menu.style.display = 'none';
    area.style.display = 'block';
    listaAulas.style.display = 'grid'; 
    containerPlayer.style.display = 'none'; 
    listaAulas.innerHTML = ''; 
    
    // Mostra o botão de apostila por padrão (será escondido se não houver PDF)
    if(btnApostila) btnApostila.style.display = 'flex';

    if (moduloId === 'modulo1') {
        // Define o link da apostila do Módulo 1
        if(btnApostila) btnApostila.href = "APOSTILA DE ÓPTICA GEOMÉTRICA.pdf";
        
        adicionarAula("Módulo I: Aula 1 - Óptica Geométrica", "10Wb2lQbOtNgYUuF2TU3lRq0cbqHhL-kQ");
        adicionarAula("Módulo I: Aula 2 - Óptica Geométrica","1_n0DraC48T4sogFxR3NPngtGQNz7IOki");
        adicionarAula("Módulo I: Aula 3 - Óptica Geométrica","1Zjjed9_SZ6Q5JpF-o936z8KSM16lxVGR");
        adicionarAula("Módulo I: Aula 4 - Óptica Geométrica", "14LEBDW2SoCoe63LfwFvFHSMVaTOqsCSI");
        adicionarAula("Módulo I: Aula 5 - Óptica Geométrica", "1Hln6uthoX0eUiGeof4Kqbz9WkPeKWLiY");
        adicionarAula("Módulo I: Aula 6 - Óptica Geométrica", "1Pb4auX8EE6TUV7xohO1_FMdAt4MlD7Oq");
        adicionarAula("Módulo I: Aula 7 - Óptica Geométrica", "1SQmc5ZDnQKArcZt30p8gDfR-lUjkoZsR");
        adicionarAula("Módulo I: Aula 8 - Óptica Geométrica", "19iLIgleT4FrujfYrJ-fC2OzzjNxC1Msn");
        adicionarAula("Módulo I: Aula 9 - Óptica Geométrica", "1UaBXCFHuWw6kcgKGKWbxoelOEUNT9CZ_");
        adicionarAula("Módulo I: Aula 10 - Óptica Geométrica", "1ymJoNPSUkFW7vE8u0GlGj3UYhFjvFiy3");
        
        // adicionarAula("Módulo I: Aula 2 - Exemplo", "ID_VIDEO");
    } 
    else {
        // Se não houver conteúdo, esconde o botão da apostila
        if(btnApostila) btnApostila.style.display = 'none';
        
        listaAulas.innerHTML = `
            <div style="padding:40px; text-align:center; background:#f9f9f9; border-radius:10px; grid-column: 1/-1;">
                <i class="fas fa-clock fa-3x" style="color:#ccc"></i>
                <p style="margin-top:10px; color:#666;">Conteúdo em breve para este módulo.</p>
            </div>`;
    }
}

// Função para criar o botão da aula na lista
function adicionarAula(titulo, idVideo) {
    const listaAulas = document.getElementById('listaAulasModulo');
    const card = document.createElement('button');
    card.className = 'modulo-card';
    card.innerHTML = `
        <span class="modulo-num"><i class="fas fa-play" style="font-size:0.8rem"></i></span>
        <div class="modulo-txt">
            <h3>${titulo}</h3>
            <p>Clique para assistir agora</p>
        </div>
    `;
    card.onclick = () => carregarVideo(titulo, idVideo);
    listaAulas.appendChild(card);
}

// Função que realmente carrega o iframe
function carregarVideo(titulo, idVideo) {
    const listaAulas = document.getElementById('listaAulasModulo');
    const containerPlayer = document.getElementById('containerPlayer');
    const player = document.getElementById('playerVideo');
    const tituloDisplay = document.getElementById('tituloAula');

    listaAulas.style.display = 'none'; // Esconde a lista de aulas
    containerPlayer.style.display = 'block'; // Mostra o player
    
    tituloDisplay.innerText = titulo;
    player.innerHTML = `
        <iframe src="https://drive.google.com/file/d/${idVideo}/preview" 
                width="100%" height="450" frameborder="0" allow="autoplay"></iframe>
    `;
}

function voltarAosModulos() {
    const menu = document.getElementById('menuModulos');
    const area = document.getElementById('areaVideo');
    const player = document.getElementById('playerVideo');
    const containerPlayer = document.getElementById('containerPlayer');

    if(menu) menu.style.display = 'grid';
    if(area) area.style.display = 'none';
    if(containerPlayer) containerPlayer.style.display = 'none';
    if(player) player.innerHTML = ''; 
}

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
    popularEscalas();
    configurarReplicacao();
});


function logout() { sessionStorage.clear(); window.location.href = "index.html"; }
