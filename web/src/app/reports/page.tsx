export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Relatórios</h1>
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-2">Resumo</h2>
        <p className="text-gray-600 mb-4">Dados consolidados de vagas e candidatos (exemplo).</p>
        <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
          <li>Total de vagas criadas por você nos últimos 90 dias</li>
          <li>Total de candidatos cadastrados por você</li>
          <li>Top 3 vagas com mais candidatos</li>
        </ul>
      </div>
    </div>
  )
}


