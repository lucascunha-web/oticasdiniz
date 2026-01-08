// URL da sua API de Ranking de Lojas
const URL_API_LOJAS = "https://script.google.com/macros/s/AKfycbwUtgz7OEUMNqmctX0I7uWh8dy-jw7RhihH1rtOZP3IrEeVKYhxDOdYA0cPiAIo6EiH1g/exec";

// URL da sua API de Totais da Rede (I1 e I2)
const URL_API_TOTAIS_REDE = "https://script.google.com/macros/s/AKfycbxBtChCeNfo9y7x-8M1f0J8ByG1FnKAMjqcaUhUF92Y1gIpjnLk0d_3HDwrl3S3XpTE/exec";

async function carregarRankingLojas() {
    console.log("Iniciando carga do ranking de lojas e totais...");
    
    const rankingLojasContainer = document.getElementById('rankingLojasContainer');
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
        // Tenta buscar os dados das duas APIs
        // Adicionamos redirect: 'follow' para lidar com o comportamento do Google Scripts
        const [resLojas, resTotais] = await Promise.allSettled([
            fetch(URL_API_LOJAS + "?t=" + Date.now()),
            fetch(URL_API_TOTAIS_REDE + "?t=" + Date.now())
        ]);

        // Processa dados da API de Lojas (Obrigatória)
        if (resLojas.status === "rejected") throw new Error("Falha na API Principal");
        const data = await resLojas.value.json();

        // Processa dados da API de Totais (Opcional - se falhar mostra "...")
        let dadosRede = { redeTotalVendas: "...", redeTicketMedio: "..." };
        if (resTotais.status === "fulfilled") {
            try {
                dadosRede = await resTotais.value.json();
            } catch (e) { console.error("Erro ao converter JSON de totais"); }
        }
        
        rankingLojasContainer.innerHTML = "";

        // 1. RENDERIZA O CARD DE TOTAIS GERAIS (Card Preto)
        const resumoHtml = `
            <div class="card-totais-gerais">
                <div class="total-item">
                    <span>TOTAL FATURADO</span>
                    <strong>${Number(data.totalFaturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div class="total-item">
                    <span>Nº DE VENDAS</span>
                    <strong>${dadosRede.redeTotalVendas || "0"}</strong>
                </div>
                <div class="total-item">
                    <span>TICKET MÉDIO</span>
                    <strong>${dadosRede.redeTicketMedio || "R$ 0,00"}</strong>
                </div>
                <div class="total-item">
                    <span>PROJEÇÃO TOTAL</span>
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

        data.lojas.sort((a, b) => b.faturado - a.faturado);

        data.lojas.forEach((loja, index) => {
            // 1. Formata todos os valores numéricos para Moeda BRL
            const faturadoFormatado = Number(loja.faturado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const projecaoFormatada = Number(loja.projecao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const metaFormatada = Number(loja.meta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const peFormatado = Number(loja.pe).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            // 2. Define a cor da badge de comissão
            let statusClass = "status-normal";
            if(loja.statusComissao && !loja.statusComissao.toUpperCase().includes("NÃO")) {
                statusClass = "status-meta";
            }

            // 3. Monta o HTML com os novos campos META: e P.E:
            const itemHtml = `
                <div class="ranking-item-loja">
                    <div class="loja-rank-pos">${index + 1}º</div>
                    <div class="loja-info-principal">
                        <span class="loja-nome">LOJA ${loja.loja}</span>
                        
                        <div style="display: flex; flex-direction: column; font-size: 0.75rem; margin-top: 4px; gap: 1px;">
                            <span style="color: #555;"><strong>META:</strong> ${metaFormatada}</span>
                            <span style="color: #555;"><strong>P.E:</strong> ${peFormatado}</span>
                            <span class="loja-faturamento" style="margin-top: 2px; font-size: 0.85rem; color: #1a1a1a;">
                                <strong>FATURADO:</strong> ${faturadoFormatado}
                            </span>
                        </div>
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
        console.error("Erro ao carregar dados:", error);
        rankingLojasContainer.innerHTML = `<p style="color:red; text-align:center;">Erro ao conectar com as planilhas. Verifique a publicação do Script.</p>`;
    }
}

window.addEventListener('load', carregarRankingLojas);