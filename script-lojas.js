// URL da sua API do Google Apps Script
const URL_API_LOJAS = "https://script.google.com/macros/s/AKfycbwUtgz7OEUMNqmctX0I7uWh8dy-jw7RhihH1rtOZP3IrEeVKYhxDOdYA0cPiAIo6EiH1g/exec";

async function carregarRankingLojas() {
    console.log("Iniciando carga do ranking de lojas e totais...");
    
    const rankingLojasContainer = document.getElementById('rankingLojasContainer');
    const areaRankingLojas = document.getElementById('areaRankingLojas');
    
    // Busca dados de login (sessionStorage é prioridade conforme seu script de login)
    let usuarioRaw = sessionStorage.getItem('usuarioLogado') || localStorage.getItem('usuarioLogado');
    
    if (!usuarioRaw) {
        console.error("Erro: Usuário não identificado.");
        return;
    }

    const usuarioLogado = JSON.parse(usuarioRaw);
    const nivelAcesso = usuarioLogado.nivel ? usuarioLogado.nivel.toLowerCase().trim() : "";

    // Validação de acesso para Admin ou Gerente
    if (nivelAcesso === "admin" || nivelAcesso === "gerente") {
        if (areaRankingLojas) areaRankingLojas.style.display = "block";
    } else {
        if (areaRankingLojas) areaRankingLojas.style.display = "none";
        return;
    }

    try {
        // Fetch com timestamp para evitar cache
        const response = await fetch(URL_API_LOJAS + "?t=" + new Date().getTime());
        const data = await response.json(); 
        
        // Limpa o container antes de renderizar
        rankingLojasContainer.innerHTML = "";

        // 1. RENDERIZA O CARD DE TOTAIS GERAIS (C9 e D9 da planilha)
        const resumoHtml = `
            <div class="card-totais-gerais">
                <div class="total-item">
                    <span>TOTAL FATURADO</span>
                    <strong>${Number(data.totalFaturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div class="total-item">
                    <span>PROJEÇÃO TOTAL DO MÊS</span>
                    <strong style="color: #2ecc71;">${Number(data.totalProjecao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
            </div>
        `;
        rankingLojasContainer.innerHTML += resumoHtml;

        // 2. RENDERIZA O RANKING DAS LOJAS
        if (!data.lojas || data.lojas.length === 0) {
            rankingLojasContainer.innerHTML += "<p>Nenhuma loja encontrada.</p>";
            return;
        }

        // Ordena a lista de lojas por faturamento (maior para menor)
        data.lojas.sort((a, b) => b.faturado - a.faturado);

        data.lojas.forEach((loja, index) => {
            const faturadoFormatado = Number(loja.faturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const projecaoFormatada = Number(loja.projecao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            // Define cor do status (Verde se a comissão estiver ativada/meta batida)
            let statusClass = "status-normal";
            if(loja.statusComissao && !loja.statusComissao.toUpperCase().includes("NÃO")) {
                statusClass = "status-meta";
            }

            const itemHtml = `
                <div class="ranking-item-loja">
                    <div class="loja-rank-pos">${index + 1}º</div>
                    <div class="loja-info-principal">
                        <span class="loja-nome">LOJA ${loja.loja}</span>
                        <span class="loja-faturamento">Faturado: ${faturadoFormatado}</span>
                    </div>
                    <div class="loja-stats-extra">
                        <span class="loja-projecao">Proj: ${projecaoFormatada}</span>
                        <span class="badge-status ${statusClass}">${loja.statusComissao}</span>
                    </div>
                </div>
            `;
            rankingLojasContainer.innerHTML += itemHtml;
        });

    } catch (error) {
        console.error("Erro ao carregar dados da API:", error);
        if (rankingLojasContainer) {
            rankingLojasContainer.innerHTML = `<p style="color:red; text-align:center;">Erro ao conectar com a planilha de lojas.</p>`;
        }
    }
}

// Inicia o processo
window.addEventListener('load', carregarRankingLojas);