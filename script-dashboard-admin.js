const URL_GAS_ADMIN = "https://script.google.com/macros/s/AKfycbyQDni02VLo08WgFLia28UMfYNDOVmcpfkY462mhT9zSqKr0v4MxaMhsiGnCm3Q91I-aw/exec";

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('meuNovoDashboardContainer');
    if (container) carregarDashboard("2026");
});

function mostrarLoading(container) {
    container.innerHTML = `
        <div class="adm-header skeleton" style="height: 70px; margin-bottom: 20px;"></div>
        <div class="adm-table-wrapper skeleton" style="height: 350px; width: 100%; margin-bottom: 20px;"></div>
        <div class="adm-rank-grid">
            ${Array(4).fill('<div class="adm-rank-card skeleton" style="height: 250px;"></div>').join('')}
        </div>
    `;
}

async function carregarDashboard(ano) {
    const container = document.getElementById('meuNovoDashboardContainer');
    mostrarLoading(container);

    try {
        const response = await fetch(`${URL_GAS_ADMIN}?ano=${ano}`);
        const dados = await response.json();

        // Identifica a linha da Empresa e as Lojas individuais
        const empresa = dados.find(d => d.loja.toString().toUpperCase() === "EMPRESA");
        const lojas = dados.filter(d => d.loja.toString().toUpperCase() !== "EMPRESA");

        container.innerHTML = `
            <div class="adm-header">
                <h2><i class="fas fa-chart-line"></i> Painel Consolidado ${ano}</h2>
                <select class="adm-select" onchange="carregarDashboard(this.value)">
                    <option value="2026" ${ano === '2026' ? 'selected' : ''}>2026</option>
                    <option value="2025" ${ano === '2025' ? 'selected' : ''}>2025</option>
                </select>
            </div>

            <div class="adm-table-wrapper">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th>Loja</th>
                            <th>Vendas</th>
                            <th>Ticket Médio</th>
                            <th>Desconto</th>
                            <th>CMV</th>
                            <th>Faturamento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lojas.map(l => `
                            <tr>
                                <td>Loja ${l.loja}</td>
                                <td>${l.vendas}</td>
                                <td>R$ ${l.ticket.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                <td>${l.desconto.toFixed(2)}%</td>
                                <td>${l.cmv || '---'}</td>
                                <td>R$ ${l.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            </tr>
                        `).join('')}
                        <tr class="adm-row-total">
                            <td>EMPRESA</td>
                            <td>${empresa.vendas}</td>
                            <td>R$ ${empresa.ticket.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                            <td>${empresa.desconto.toFixed(2)}%</td>
                            <td>${empresa.cmv || '---'}</td>
                            <td>R$ ${empresa.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="adm-rank-grid">
                ${gerarRankHTML("Faturamento", lojas, "faturamento", "R$ ")}
                ${gerarRankHTML("Nº Vendas", lojas, "vendas", "")}
                ${gerarRankHTML("Ticket Médio", lojas, "ticket", "R$ ")}
                ${gerarRankHTML("Desconto", lojas, "desconto", "", "%")}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="adm-error">Erro ao conectar: ${e.message}</div>`;
    }
}

function gerarRankHTML(titulo, dados, chave, pre = "", suf = "") {
    const ordenado = [...dados].sort((a, b) => b[chave] - a[chave]);
    const max = Math.max(...dados.map(d => d[chave])) || 1;

    return `
        <div class="adm-rank-card">
            <h4>${titulo}</h4>
            ${ordenado.slice(0, 7).map((l, i) => `
                <div class="adm-rank-item">
                    <div class="adm-rank-info">
                        <span>${i+1}º Loja ${l.loja}</span>
                        <span>${pre}${l[chave].toLocaleString('pt-BR')}${suf}</span>
                    </div>
                    <div class="adm-rank-bar-bg">
                        <div class="adm-rank-bar-fill" style="width: ${(l[chave]/max)*100}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}