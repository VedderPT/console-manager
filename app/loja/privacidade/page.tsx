import Link from 'next/link';
import { PHONE_SHOWN } from '@/lib/shop';

export const metadata = { title: 'Privacidade · Star Tech' };

export default function Privacidade() {
  return (
    <article className="prose-invert mt-6 space-y-4 text-sm text-slate-300">
      <Link href="/loja/" className="text-sky-400">← Voltar</Link>
      <h1 className="text-2xl font-bold text-slate-100">Privacidade</h1>
      <p>Quando fazes um pedido neste site, a Star Tech (Faro, Portugal) recebe os dados que preenches no formulário.</p>
      <h2 className="font-semibold text-slate-100">Que dados recolhemos</h2>
      <p>Nome, telemóvel, e-mail (opcional), morada (só se escolheres envio), a consola e opções que escolheste, forma de entrega e de pagamento, e as notas que escreveres.</p>
      <h2 className="font-semibold text-slate-100">Para quê</h2>
      <p>Apenas para tratar o teu pedido e contactar-te sobre ele (por WhatsApp, telemóvel ou e-mail). Não usamos os dados para publicidade nem os vendemos ou partilhamos com terceiros para esse fim.</p>
      <h2 className="font-semibold text-slate-100">Onde ficam guardados</h2>
      <p>Num serviço de alojamento de dados que usamos para gerir os pedidos. Os avisos internos de novos pedidos não incluem os teus dados pessoais.</p>
      <h2 className="font-semibold text-slate-100">Durante quanto tempo</h2>
      <p>Pelo tempo necessário para tratar o pedido e cumprir obrigações legais que se apliquem.</p>
      <h2 className="font-semibold text-slate-100">Os teus direitos</h2>
      <p>Podes pedir acesso, correção ou apagamento dos teus dados, e retirar o consentimento a qualquer momento, contactando-nos por WhatsApp ou telemóvel ({PHONE_SHOWN}). Podes também apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).</p>
    </article>
  );
}
