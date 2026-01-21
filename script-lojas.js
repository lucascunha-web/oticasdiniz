// URLs das APIs
const URL_API_LOJAS = "https://script.google.com/macros/s/AKfycbwUtgz7OEUMNqmctX0I7uWh8dy-jw7RhihH1rtOZP3IrEeVKYhxDOdYA0cPiAIo6EiH1g/exec";
const URL_API_TOTAIS_REDE = "https://script.google.com/macros/s/AKfycbxBtChCeNfo9y7x-8M1f0J8ByG1FnKAMjqcaUhUF92Y1gIpjnLk0d_3HDwrl3S3XpTE/exec";

// Variáveis globais para armazenar o cache dos dados
let cacheDadosRanking = null;
let cacheDadosRede = null;

async function carregarRankingLojas() {
    console.log("Iniciando carga do ranking de lojas e totais...");
    
    const areaRankingLojas = document.getElementById('areaRankingLojas');
    
    let usuarioRaw = sessionStorage.getItem('usuarioLogado') || localStorage.getItem('usuarioLogado');
    if (!usuarioRaw) return;

    const usuarioLogado = JSON.parse(usuarioRaw);
    const nivelAcesso = usuarioLogado.nivel ? usuarioLogado.nivel.toLowerCase().trim() : "";

    if (nivelAcesso === "admin" || nivelAcesso === "gerente") {
        if (areaRankingLojas) areaRankingLojas.style.display = "block";
    } else {
        if (areaRankingLojas) areaRankingLojas.style.display = "none";
        return;
    }

    try {
        // Busca os dados das duas APIs simultaneamente
        const [resLojas, resTotais] = await Promise.allSettled([
            fetch(URL_API_LOJAS + "?t=" + Date.now()),
            fetch(URL_API_TOTAIS_REDE + "?t=" + Date.now())
        ]);

        // Processa API de Ranking (Faturamento/Projeção/Meta/PE)
        if (resLojas.status === "rejected") throw new Error("Falha na API Principal");
        cacheDadosRanking = await resLojas.value.json();

        // Processa API de Totais da Rede (Vendas/Ticket/Desconto/CMV/DadosIndividuais)
        if (resTotais.status === "fulfilled") {
            try {
                cacheDadosRede = await resTotais.value.json();
            } catch (e) { console.error("Erro ao converter JSON de totais"); }
        }
        
        // Renderiza a lista de lojas (o ranking fixo abaixo do card)
        renderizarListaRanking();
        
        // Renderiza o Card Preto (Inicialmente no modo Geral)
        atualizarCardTotais();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        document.getElementById('rankingLojasContainer').innerHTML = `<p style="color:red; text-align:center;">Erro ao conectar com as planilhas.</p>`;
    }
}

// Função que atualiza os números do Card Preto com base no Filtro
function atualizarCardTotais() {
    const filtro = document.getElementById('filtroLojaRanking').value;
    const container = document.getElementById('rankingLojasContainer');
    
    if (!cacheDadosRanking || !cacheDadosRede) return;

    let faturamento, vendas, desconto, cmv, ticket, projecao;

    if (filtro === "geral") {
        // Dados Gerais da Rede
        faturamento = Number(cacheDadosRanking.totalFaturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        vendas = cacheDadosRede.redeTotalVendas || "0";
        desconto = cacheDadosRede.rededesconto || "0%";
        cmv = cacheDadosRede.cmvred || "0%"; // Valor do CMV para a rede
        ticket = cacheDadosRede.redeTicketMedio || "R$ 0,00";
        projecao = Number(cacheDadosRanking.totalProjecao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } else {
        // Dados de uma Loja Específica
        const lojaRanking = cacheDadosRanking.lojas.find(l => String(l.loja) === String(filtro));
        const lojaRede = cacheDadosRede.dadosPorLoja ? cacheDadosRede.dadosPorLoja[filtro] : null;

        faturamento = lojaRanking ? Number(lojaRanking.faturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00";
        vendas = lojaRede ? lojaRede.vendas : "0"; // Puxa da coluna B
        desconto = lojaRede ? lojaRede.desconto : "0%"; // Puxa da coluna C
        ticket = lojaRede ? lojaRede.ticket : "R$ 0,00"; // Puxa da coluna D
        projecao = lojaRanking ? Number(lojaRanking.projecao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00";
        
        cmv = null; // Definimos como null para a lógica do HTML abaixo
    }

    // Geramos o bloco do CMV apenas se o filtro for "geral"
    const htmlCMV = (filtro === "geral") ? `
        <div class="total-item">
            <span>CMV</span>
            <strong>${cmv}</strong>
        </div>
    ` : ""; 

    const cardHtml = `
        <div class="card-totais-gerais" id="cardPretoDinamico">
            <div class="total-item">
                <span>TOTAL FATURADO</span>
                <strong>${faturamento}</strong>
            </div>
            <div class="total-item">
                <span>Nº DE VENDAS</span>
                <strong>${vendas}</strong>
            </div>
            <div class="total-item">
                <span>DESCONTO</span>
                <strong>${desconto}</strong>
            </div>
            ${htmlCMV} 
            <div class="total-item">
                <span>TICKET MÉDIO</span>
                <strong>${ticket}</strong>
            </div>
            <div class="total-item">
                <span>PROJEÇÃO TOTAL</span>
                <strong style="color: #2ecc71;">${projecao}</strong>
            </div>
        </div>
        <div id="listaLojasDinamica"></div>
    `;

    container.innerHTML = cardHtml;
    renderizarListaRanking();
}

function renderizarListaRanking() {
    const listaContainer = document.getElementById('listaLojasDinamica');
    if (!listaContainer || !cacheDadosRanking) return;

    listaContainer.innerHTML = "";
    
    // Ordena por faturamento
    const lojasOrdenadas = [...cacheDadosRanking.lojas].sort((a, b) => b.faturado - a.faturado);

    lojasOrdenadas.forEach((loja, index) => {
        const statusClass = (loja.statusComissao && !loja.statusComissao.toUpperCase().includes("NÃO")) ? "status-meta" : "status-normal";
        
        const itemHtml = `
            <div class="ranking-item-loja">
                <div class="loja-rank-pos">${index + 1}º</div>
                <div class="loja-info-principal">
                    <span class="loja-nome">LOJA ${loja.loja}</span>
                    <div style="display: flex; flex-direction: column; font-size: 0.75rem; margin-top: 4px; gap: 1px;">
                        <span style="color: #555;"><strong>META:</strong> ${Number(loja.meta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span style="color: #555;"><strong>P.E:</strong> ${Number(loja.pe).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span class="loja-faturamento" style="margin-top: 2px; font-size: 0.85rem; color: #1a1a1a;">
                            <strong>FATURADO:</strong> ${Number(loja.faturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>
                <div class="loja-stats-extra">
                    <span class="loja-projecao">Proj: ${Number(loja.projecao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span class="badge-status ${statusClass}">${loja.statusComissao}</span>
                </div>
            </div>
        `;
        listaContainer.innerHTML += itemHtml;
    });
}

window.addEventListener('load', carregarRankingLojas);