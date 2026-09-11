import './globals.css';
import AuthGate from './AuthGate';
import './personal.css';
export const metadata={title:'RLA Nexo | Seu dinheiro, com clareza',description:'Assistente financeiro pessoal com decisões baseadas em cálculos determinísticos.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><AuthGate>{children}</AuthGate></body></html>}
