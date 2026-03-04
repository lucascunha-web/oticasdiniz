document.addEventListener("DOMContentLoaded", function () {
    const API_URL = "https://script.google.com/macros/s/AKfycbzqiaG7vdEl_y9AzZnc0v7qwcxYX8QCFTw5R3kLh33jBWOpbbylo3pQfRE-U58Wb2d8yQ/exec";

function aplicarRestricoesAcesso() {
    // Alvo: o container que engloba o botão e o submenu
    const containerOrc = document.getElementById("containerOrcamentos");
    if (!containerOrc) return;

    const storage = sessionStorage.getItem("usuarioLogado") || localStorage.getItem("usuarioLogado");
    
    if (storage) {
        try {
            const user = JSON.parse(storage);
            const nomeUser = user.nome ? user.nome.toUpperCase().trim() : "";

            // Libera apenas para o RODRIGO
            if (nomeUser === "RODRIGO") {
                containerOrc.style.display = "block"; 
            } else {
                containerOrc.style.display = "none";
            }
        } catch (e) {
            console.error("Erro na permissão:", e);
            containerOrc.style.display = "none";
        }
    }
}

// Executa ao carregar
window.addEventListener("load", aplicarRestricoesAcesso);
// 3. Executa ao carregar a página
window.addEventListener("load", aplicarRestricoesAcesso);

    // === 1. CSS ULTRA PREMIUM CORRIGIDO ===
    const styleSheet = document.createElement("style");
    styleSheet.innerHTML = `
     :root {
            --primary-orc: #B71C1C; --success-orc: #2e7d32; --danger-orc: #d32f2f;
            --info-orc: #1565c0; --whatsapp: #25D366; --bg-card: #ffffff;
        }
        .content-section { display: none; width: 100%; padding: 20px; box-sizing: border-box; }
        .content-section.active { display: block; animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Indicadores Coloridos por Inteiro */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin-bottom: 25px; }
        
        .card-stat-box { 
            border-radius: 15px; padding: 20px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.12); 
            transition: 0.3s;
            border: none;
        }
        
        .card-stat-box:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        
        /* Estilo dos textos dentro dos cards coloridos */
        .card-stat-box h3 { font-size: 0.7rem; color: rgba(255,255,255,0.9); text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; font-weight: 600; }
        .card-stat-box p { font-size: 1.6rem; font-weight: 800; margin: 0; color: #fff; }

        /* Classes de cores sólidas */
        .bg-total { background: #455a64; } /* Cinza Escuro / Grafite */
        .bg-conv  { background: var(--success-orc); } /* Verde */
        .bg-perd  { background: var(--danger-orc); }  /* Vermelho */
        .bg-resg  { background: var(--info-orc); }    /* Azul */
        .bg-taxa  { background: #6a1b9a; }            /* Roxo */

        /* Kanban & Cards */
        .orc-kanban { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: start; }
        .kanban-col { background: #f4f4f4; border-radius: 12px; padding: 10px; min-height: 500px; border: 1px solid #e0e0e0; }
        .col-header { padding: 12px; font-weight: 800; color: #fff; text-align: center; border-radius: 8px; margin-bottom: 15px; font-size: 0.85rem; }
        .card-orc-final { 
            background: #fff; padding: 15px; border-radius: 10px; margin-bottom: 12px;
            box-shadow: 0 3px 6px rgba(0,0,0,0.05); border-left: 5px solid #ccc; cursor: pointer; transition: 0.2s;
        }
        .card-orc-final:hover { transform: translateY(-3px); box-shadow: 0 6px 15px rgba(0,0,0,0.1); }

        /* Gráficos Estilizados */
        .dashboard-row { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px; margin-top: 20px; }
        .chart-box-fixo { background: #fff; padding: 20px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); border: 1px solid #eee; position: relative; }
        
        /* Modal Corrigido */
        .modal-orc-v2 { display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); }
        .modal-content-v2 { 
            background: #fff; margin: 5vh auto; width: 90%; max-width: 500px; border-radius: 20px; 
            overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: slideUp 0.4s ease-out; 
        }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .form-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; font-family: inherit; }
        .btn-acao { border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        
        .skeleton { background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: loading 1.5s infinite; height: 80px; border-radius: 8px; margin: 10px; }
        @keyframes loading { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    `;
    document.head.appendChild(styleSheet);

    const mesAtualStr = new Date().toISOString().slice(0, 7);
    const listaMotivos = ["PREÇO", "MIX DE ARMAÇÃO", "PRAZO DE ENTREGA",  "MIX DE LENTE", "PESQUISA DE MERCADO", "CONDIÇÃO DE PAGAMENTO", "ACOMPANHANTE AUSENTE", "OUTROS"];

    // === 2. ESTRUTURA DAS ABAS ===
    const abaGestao = document.getElementById('aba-orc-mes');
    const abaStats = document.getElementById('aba-orc-stats');

    if (abaGestao) {
        abaGestao.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#fff; padding:15px; border-radius:15px; box-shadow:0 2px 10px rgba(0,0,0,0.05)">
                <h2 style="margin:0; font-size:1.1rem">Gestão de Orçamentos</h2>
                <div style="display:flex; gap:10px">
                    <button id="btnNovoOrc" class="btn-acao" style="background:var(--success-orc); color:#fff"><i class="fas fa-plus"></i> NOVO</button>
                    <input type="month" id="filtroDataOrc" value="${mesAtualStr}" style="padding:8px; border-radius:8px; border:1px solid #ddd">
                </div>
            </div>
            <div class="orc-kanban">
                <div class="kanban-col"><div class="col-header" style="background:var(--success-orc)">CONVERTIDOS</div><div id="lista-convertidos"></div></div>
                <div class="kanban-col"><div class="col-header" style="background:var(--danger-orc)">PERDIDOS</div><div id="lista-perdidos"></div></div>
                <div class="kanban-col"><div class="col-header" style="background:var(--info-orc)">RESGATADOS</div><div id="lista-resgatados"></div></div>
            </div>
        `;
    }

if (abaStats) {
        abaStats.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#fff; padding:15px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05)">
                <h2 style="margin:0; font-size:1.1rem">Estatísticas</h2>
                <input type="month" id="filtroStatsMes" value="${mesAtualStr}" style="padding:8px; border-radius:8px; border:1px solid #ddd">
            </div>

            <div class="stats-grid">
                <div class="card-stat-box bg-total">
                    <h3>Total</h3>
                    <p id="st-total">0</p>
                </div>
                <div class="card-stat-box bg-conv">
                    <h3>Convertidos</h3>
                    <p id="st-conv">0</p>
                </div>
                <div class="card-stat-box bg-perd">
                    <h3>Perdidos</h3>
                    <p id="st-perd">0</p>
                </div>
                <div class="card-stat-box bg-resg">
                    <h3>Resgatados</h3>
                    <p id="st-resg">0</p>
                </div>
                <div class="card-stat-box bg-taxa">
                    <h3>Taxa Conv.</h3>
                    <p id="st-taxa">0%</p>
                </div>
            </div>

            <div class="dashboard-row">
                <div class="chart-box-fixo">
                    <h4 style="margin:0 0 13px 0; font-size:0.9rem; color:#444">HISTÓRICO</h4>
                    <div id="containerHistorico" style="height:245px"></div>
                </div>
                <div class="chart-box-fixo">
                    <h4 style="margin:0 0 15px 0; font-size:0.9rem; color:#444">MOTIVOS DE PERDA</h4>
                    <div id="containerPizzaMotivos"></div>
                </div>
            </div>
        `;
    }

    // Injeção do Modal Único no Body (Corrigido para garantir que exista)
    if (!document.getElementById("modalOrcamento")) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modalOrcamento" class="modal-orc-v2">
                <div class="modal-content-v2">
                    <div style="background:var(--primary-orc); color:#fff; padding:18px; display:flex; justify-content:space-between; align-items:center">
                        <h3 id="modalTitle" style="margin:0; font-size:1.1rem">Detalhes</h3>
                        <span id="closeModal" style="cursor:pointer; font-size:28px; line-height:1">&times;</span>
                    </div>
                    <div id="conteudoModalOrc" style="padding:25px; max-height:75vh; overflow-y:auto"></div>
                </div>
            </div>
        `);
    }

    // === 3. LÓGICA DE GRÁFICOS (MUITAS LINHAS E CORES SÓLIDAS) ===

    async function carregarHistoricoAnual() {
        const container = document.getElementById("containerHistorico");
        container.innerHTML = '<div class="skeleton"></div>';
        const ano = new Date().getFullYear();
        const dadosAnuais = await executarApi({ action: "listar", mesAno: ano.toString() });
        
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const pontos = meses.map((_, i) => {
         const dMes = dadosAnuais.filter(item => item.data && item.data.includes(`/${(i+1).toString().padStart(2,'0')}/`));
         const sucessos = dMes.filter(x => x.status.includes('CONV') || x.status.includes('RESG')).length;
         return dMes.length ? Math.round((sucessos / dMes.length) * 100) : 0;
        });

        const maxH = 180;
        const width = container.offsetWidth || 400;
        const step = (width - 40) / 11;

        let svg = `<svg viewBox="0 0 ${width} 220" style="width:100%; height:100%">
            ${[0, 20, 40, 60, 80, 100].map(v => `
                <line x1="30" y1="${maxH - (v*1.8)}" x2="${width-10}" y2="${maxH - (v*1.8)}" stroke="#f0f0f0" stroke-width="1" />
                <text x="5" y="${maxH - (v*1.8) + 4}" font-size="10" fill="#bbb">${v}%</text>
            `).join('')}
            
            <path d="M 30 ${maxH} ${pontos.map((p, i) => `L ${30 + (i*step)} ${maxH - (p*1.8)}`).join(' ')} L ${30 + (11*step)} ${maxH} Z" 
                  fill="rgba(183, 28, 28, 0.15)" stroke="none" />
            
            <polyline points="${pontos.map((p, i) => `${30 + (i*step)},${maxH - (p*1.8)}`).join(' ')}" 
                      fill="none" stroke="var(--primary-orc)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            ${pontos.map((p, i) => `
                <circle cx="${30 + (i*step)}" cy="${maxH - (p*1.8)}" r="5" fill="var(--primary-orc)" style="cursor:pointer" data-tooltip="${meses[i]}: ${p}%"></circle>
                <text x="${30 + (i*step) - 10}" y="210" font-size="10" fill="#888">${meses[i]}</text>
            `).join('')}
        </svg>`;
        
        container.innerHTML = svg;

        let tooltip = document.getElementById("tooltipHistoricoAnual");
        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "tooltipHistoricoAnual";
            tooltip.style.position = "fixed";
            tooltip.style.zIndex = "9999";
            tooltip.style.background = "rgba(0,0,0,0.85)";
            tooltip.style.color = "#fff";
            tooltip.style.padding = "6px 8px";
            tooltip.style.borderRadius = "6px";
            tooltip.style.fontSize = "12px";
            tooltip.style.pointerEvents = "none";
            tooltip.style.opacity = "0";
            tooltip.style.transition = "opacity 0.12s ease";
            document.body.appendChild(tooltip);
        }

        container.querySelectorAll("circle[data-tooltip]").forEach((ponto) => {
            ponto.addEventListener("mouseenter", (e) => {
                tooltip.textContent = e.target.getAttribute("data-tooltip");
                tooltip.style.opacity = "1";
            });

            ponto.addEventListener("mousemove", (e) => {
                tooltip.style.left = `${e.clientX + 12}px`;
                tooltip.style.top = `${e.clientY - 28}px`;
            });

            ponto.addEventListener("mouseleave", () => {
                tooltip.style.opacity = "0";
            });
        });
    }

 function renderizarPizzaMotivos(perdidos) {
        const container = document.getElementById("containerPizzaMotivos");
        if (!perdidos.length) { 
            container.innerHTML = "<p style='color:#999; text-align:center; padding:20px'>Sem perdas registradas.</p>"; 
            return; 
        }
        
        const counts = {};
        perdidos.forEach(p => counts[p.motivo || "OUTROS"] = (counts[p.motivo || "OUTROS"] || 0) + 1);
        
        const total = perdidos.length;
        const colors = ['#B71C1C', '#1565C0', '#2E7D32', '#FF9800', '#607D8B', '#E91E63'];
        
        // Calcular as fatias para o gradiente cônico
        let acumulado = 0;
        const fatias = Object.entries(counts).map(([motivo, qtd], i) => {
            const perc = (qtd / total) * 100;
            const inicio = acumulado;
            acumulado += perc;
            return { motivo, qtd, perc, cor: colors[i % colors.length], inicio, fim: acumulado };
        });

        const gradientString = fatias.map(f => `${f.cor} ${f.inicio}% ${f.fim}%`).join(', ');

        // HTML do Gráfico de Pizza com Legenda
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: center;">
                <div style="
                    width: 140px; 
                    height: 140px; 
                    border-radius: 50%; 
                    background: conic-gradient(${gradientString});
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                "></div>

                <div style="flex: 1; min-width: 150px;">
                    ${fatias.map(f => `
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.8rem;">
                            <div style="width: 12px; height: 12px; background: ${f.cor}; border-radius: 3px;"></div>
                            <span style="flex: 1; color: #444;">${f.motivo}</span>
                            <span style="font-weight: bold; color: #333;">${Math.round(f.perc)}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // === 4. LÓGICA DE DETALHES E NOVO ORÇAMENTO ===

const listaConsultores = ["ISABELLI", "LARISSA", "THALITA", "RODRIGO", "OUTROS"];

function abrirNovoOrcamento() {
    const body = document.getElementById("conteudoModalOrc");
    document.getElementById("modalTitle").innerText = "✨ Novo Orçamento";
    body.innerHTML = `
        <form id="formOrc">
            <label style="font-size:0.75rem; font-weight:bold; color:#666">CLIENTE</label>
            <input type="text" name="cliente" class="form-input" placeholder="Nome do cliente" required>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                <div>
                    <label style="font-size:0.75rem; font-weight:bold; color:#666">WHATSAPP</label>
                    <input type="text" name="contato" class="form-input" placeholder="(00) 00000-0000">
                </div>
                <div>
                    <label style="font-size:0.75rem; font-weight:bold; color:#666">CONSULTOR</label>
                    <select name="consultor" class="form-input" required>
                        <option value="" disabled selected>Selecione...</option>
                        ${listaConsultores.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
            </div>

            <label style="font-size:0.75rem; font-weight:bold; color:#666">STATUS</label>
            <select name="status" id="selStatus" class="form-input" required>
                <option value="CONVERTIDO">✅ CONVERTIDO</option>
                <option value="PERDIDO">❌ PERDIDO</option>
            </select>

            <div id="divMotivo" style="display:none">
                <label style="font-size:0.75rem; font-weight:bold; color:#666">MOTIVO DA PERDA</label>
                <select name="motivo" id="fieldMotivo" class="form-input">
                    <option value="" disabled selected>Escolha o motivo...</option>
                    ${listaMotivos.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
            </div>

            <label style="font-size:0.75rem; font-weight:bold; color:#666">OBSERVAÇÕES</label>
            <textarea name="observacao" class="form-input" rows="3" required placeholder="Detalhes do atendimento..."></textarea>

            <button type="submit" class="btn-acao" style="width:100%; background:var(--primary-orc); color:#fff; font-size:1rem; margin-top:10px">SALVAR REGISTRO</button>
        </form>
    `;
    document.getElementById("modalOrcamento").style.display = "block";
    
    const selStatus = document.getElementById("selStatus");
    const divMotivo = document.getElementById("divMotivo");
    const fieldMotivo = document.getElementById("fieldMotivo");

    selStatus.onchange = (e) => {
        if (e.target.value === "PERDIDO") {
            divMotivo.style.display = "block";
            fieldMotivo.required = true;
        } else {
            divMotivo.style.display = "none";
            fieldMotivo.required = false;
        }
    };

    document.getElementById("formOrc").onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.innerText = "SALVANDO..."; btn.disabled = true;

        // --- CORREÇÃO AQUI: Envolvendo os dados na chave "dados" ---
        const formData = Object.fromEntries(new FormData(e.target));
        await executarApi({ 
            action: "salvar", 
            dados: formData 
        });

        document.getElementById("modalOrcamento").style.display = "none";
        carregarOrcamentos();
    };
}

function abrirDetalhes(item) {
    const body = document.getElementById("conteudoModalOrc");
    const statusUpper = item.status.toUpperCase();
    
    // Define o emoji baseado no status
    let emojiStatus = '❌ '; // Padrão Perdido
    if (statusUpper.includes('CONV')) emojiStatus = '✅ ';
    if (statusUpper.includes('RESG')) emojiStatus = '🚀 ';

    document.getElementById("modalTitle").innerText = "📋 Detalhes do Orçamento";
    
    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:15px">
            <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#666">CLIENTE</label>
                <div class="form-input" style="background:#fdfdfd; border-color:#eee; font-weight:600">${item.cliente}</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                <div>
                    <label style="font-size:0.75rem; font-weight:bold; color:#666">WHATSAPP</label>
                    <div class="form-input" style="background:#fdfdfd; border-color:#eee; color:var(--whatsapp); font-weight:bold">
                        <i class="fab fa-whatsapp"></i> ${item.contato || 'N/A'}
                    </div>
                </div>
                <div>
                    <label style="font-size:0.75rem; font-weight:bold; color:#666">CONSULTOR</label>
                    <div class="form-input" style="background:#fdfdfd; border-color:#eee">${item.consultor}</div>
                </div>
            </div>

            <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#666">STATUS ATUAL</label>
                <div class="form-input" style="background:#fdfdfd; border-color:#eee; font-weight:bold">
                    ${emojiStatus}${item.status}
                </div>
            </div>

            ${item.motivo ? `
                <div>
                    <label style="font-size:0.75rem; font-weight:bold; color:var(--danger-orc)">MOTIVO DA PERDA</label>
                    <div class="form-input" style="background:rgba(183,28,28,0.05); border-color:var(--danger-orc); color:var(--danger-orc)">
                        ${item.motivo}
                    </div>
                </div>
            ` : ''}

            <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#666">OBSERVAÇÕES</label>
                <div class="form-input" style="background:#fdfdfd; border-color:#eee; min-height:60px; white-space: pre-wrap;">${item.observacao || 'Nenhuma observação registrada.'}</div>
            </div>

            <div style="display:flex; gap:10px; margin-top:10px; align-items: center;">
                ${statusUpper.includes('PERD') ? `
                    <button onclick="window.resgatarOrc('${item.id}')" class="btn-acao" style="background:var(--info-orc); color:#fff; flex:2">
                        <i class="fas fa-undo"></i> RESGATAR 
                    </button>
                ` : ''}

                <button onclick="window.excluirOrc('${item.id}')" class="btn-acao" style="background:#fff; color:var(--danger-orc); border:1px solid var(--danger-orc); flex:0.5; min-width:45px; display:flex; justify-content:center; align-items:center" title="Excluir permanentemente">
                    <i class="fas fa-trash-alt"></i>
                </button>
                
                <button onclick="document.getElementById('modalOrcamento').style.display='none'" class="btn-acao" style="background:#eee; color:#444; flex:1">
                    FECHAR
                </button>
            </div>
        </div>
    `;
    document.getElementById("modalOrcamento").style.display = "block";
}

    // === 5. FUNÇÕES DE APOIO ===

    async function executarApi(corpo) {
        try {
            const response = await fetch(API_URL, { method: "POST", body: JSON.stringify(corpo) });
            return JSON.parse(await response.text());
        } catch (e) { console.error("Erro API:", e); return []; }
    }

    async function carregarOrcamentos() {
        const lists = ['lista-convertidos', 'lista-perdidos', 'lista-resgatados'];
        lists.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="skeleton"></div>'.repeat(3);
        });

        const [ano, mes] = document.getElementById("filtroDataOrc").value.split("-");
        const dados = await executarApi({ action: "listar", mesAno: `${mes}/${ano}` });

        lists.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });

        if (!dados.length) {
            return lists.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<p style="text-align:center; padding:20px; color:#999; font-size:0.8rem">Nenhum registro</p>';
            });
        }

        dados.forEach(item => {
            let status = item.status.toUpperCase();
            let colId = status.includes("CONV") ? 'lista-convertidos' : (status.includes("PERD") ? 'lista-perdidos' : 'lista-resgatados');
            
            const card = document.createElement("div");
            card.className = "card-orc-final";
            card.style.borderLeftColor = status.includes("CONV") ? 'var(--success-orc)' : (status.includes("PERD") ? 'var(--danger-orc)' : 'var(--info-orc)');
            
            // --- NOVA VISUALIZAÇÃO DOS ORÇAMENTOS ---
            card.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight:bold; display:block; color:#333; font-size: 0.95rem;">
                        ${item.cliente}
                    </span>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <small style="color:#666; font-style: italic;">
                            <i class="fas fa-user-tie" style="font-size: 0.7rem; margin-right: 3px;"></i>${item.consultor}
                        </small>
                        <span style="color:var(--whatsapp); font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                            <i class="fab fa-whatsapp"></i> ${item.contato || '---'}
                        </span>
                        <small style="color:var(--calender); font-weight: bold; font-size: 0.8rem; align-items: center; gap: 4px;">
                            <i class="fab fa-calender"></i> ${item.data || '---'}
                        </small>
                    </div>
                </div>
            `;
            
            card.onclick = () => abrirDetalhes(item);
            
            const targetList = document.getElementById(colId);
            if (targetList) targetList.appendChild(card);
        });
    }

async function carregarEstatisticas() {
        const [ano, mes] = document.getElementById("filtroStatsMes").value.split("-");

        // --- 1. INÍCIO DA ANIMAÇÃO (SKELETON) ---
        // Reseta os números para um sinal de carregamento ou "..."
        const idsStatus = ["st-total", "st-conv", "st-perd", "st-resg", "st-taxa"];
        idsStatus.forEach(id => {
            document.getElementById(id).innerHTML = '<span style="opacity:0.5">...</span>';
        });

        // Coloca o skeleton nos containers de gráfico
        document.getElementById("containerPizzaMotivos").innerHTML = '<div class="skeleton" style="height:140px; border-radius:50%; width:140px; margin:auto"></div>';
        document.getElementById("containerHistorico").innerHTML = '<div class="skeleton" style="height:200px"></div>';
        
        // --- 2. CHAMADA DA API ---
        const dados = await executarApi({ action: "listar", mesAno: `${mes}/${ano}` });

        // --- 3. RENDERIZAÇÃO DOS DADOS REAIS ---
        const conv = dados.filter(i => i.status.includes('CONV')).length;
        const perd = dados.filter(i => i.status.includes('PERD')).length;
        const resg = dados.filter(i => i.status.includes('RESG')).length;
        const total = dados.length;

        document.getElementById("st-total").innerText = total;
        document.getElementById("st-conv").innerText = conv;
        document.getElementById("st-perd").innerText = perd;
        document.getElementById("st-resg").innerText = resg;
        document.getElementById("st-taxa").innerText = total > 0 ? Math.round(((conv + resg) / total) * 100) + "%" : "0%";

        renderizarPizzaMotivos(dados.filter(i => i.status.includes('PERD')));
        carregarHistoricoAnual();
    }
 window.excluirOrc = async (id) => {
    if (!confirm("⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente este orçamento?")) return;
    
    // Feedback visual no botão se desejar, ou apenas executa
    const res = await executarApi({ action: "excluir", id: id });
    
    if (res.success) {
        document.getElementById("modalOrcamento").style.display = "none";
        carregarOrcamentos(); // Recarrega o Kanban
        if (typeof carregarEstatisticas === "function") carregarEstatisticas(); // Atualiza stats se estiver nela
    } else {
        alert("Erro ao excluir: " + res.error);
    }
 };
    window.resgatarOrc = async (id) => {
        if (!confirm("Confirmar resgate deste orçamento?")) return;
        await executarApi({ action: "resgatar", id: id });
        document.getElementById("modalOrcamento").style.display = "none";
        carregarOrcamentos();
    };

    // === 6. EVENTOS GLOBAIS ===
    document.addEventListener("click", e => {
        if (e.target.closest("#btnOrcamentos") || e.target.closest("#toggleOrcMenu")) {
            const sub = document.getElementById("submenuOrcamentos");
            if (sub) sub.style.display = (sub.style.display === "flex") ? "none" : "flex";
        }

        const linkAba = e.target.closest("[data-target]");
        if (linkAba) {
            const targetId = linkAba.getAttribute("data-target");
            if (targetId.startsWith("aba-orc")) {
                document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
                document.getElementById(targetId).classList.add("active");
                if (targetId === 'aba-orc-mes') carregarOrcamentos();
                if (targetId === 'aba-orc-stats') carregarEstatisticas();
            }
        }

        if (e.target.id === "closeModal" || e.target.id === "modalOrcamento") {
            document.getElementById("modalOrcamento").style.display = "none";
        }

        if (e.target.id === "btnNovoOrc") {
            abrirNovoOrcamento();
        }
    });

    document.getElementById("filtroDataOrc").onchange = carregarOrcamentos;
    document.getElementById("filtroStatsMes").onchange = carregarEstatisticas;
});
