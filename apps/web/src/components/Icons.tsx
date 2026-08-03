/**
 * Os ícones do cliente web, como SVG inline.
 *
 * <b>Sem biblioteca de ícones, e por escolha.</b> São sete traçados; o menor pacote decente traz
 * mil e uma etapa de build para tratá-los. Inline eles herdam `currentColor`, então acompanham
 * automaticamente o tema claro e o escuro e a cor do elemento em que estão — que é exatamente o que
 * o {@link Logo} já faz aqui.
 *
 * <b>Mesmo desenho do app.</b> Os nomes e as formas espelham os Ionicons usados no Android: quem
 * usa os dois clientes não deve ter de reaprender a lupa. Traço de 2px em uma grade de 24, que é a
 * proporção do conjunto original.
 *
 * <b>Decorativos por padrão.</b> Todos saem com `aria-hidden`: em todos os usos daqui existe um
 * rótulo em texto ao lado, e anunciar os dois faria o leitor de tela repetir "Buscar, Buscar".
 * Quando o ícone for o único conteúdo de um controle, quem chama põe `aria-label` no BOTÃO — não
 * no ícone.
 */
interface IconProps {
  readonly size?: number;
  readonly className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Lupa — o único pictograma verdadeiramente universal deste conjunto. */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

/** Limpar o campo. Círculo cheio porque o "x" sozinho, em 20px, some no meio do texto. */
export function IconXCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Svg>
  );
}

/** Seta de revelar. Gira por CSS quando o `<details>` abre — ver `.shelf__summary::before`. */
export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 8-4 4 4 4M6 12h11" />
    </Svg>
  );
}

/** Próximos: o que assistir agora. */
export function IconPlayCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
    </Svg>
  );
}

/** Séries: o acervo, empilhado. */
export function IconLibrary(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="13" y="4" width="7" height="16" rx="1.5" />
    </Svg>
  );
}

export function IconPerson(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}
