import { useDesigned } from '@/lib/useDesign'
import { HomeBrasa } from './HomeBrasa'
import { HomeGrade } from './HomeGrade'
import { HomeSessao } from './HomeSessao'
import { useHomeModel } from './useHomeModel'

/**
 * "Agora": o que assistir em seguida e o que está para sair. O modelo é um só; cada design o
 * desenha à sua maneira — cartões (Brasa), palco e cartazes (Sessão), programação (Grade).
 */
export function HomePage() {
  const model = useHomeModel()
  return useDesigned({
    brasa: <HomeBrasa model={model} />,
    sessao: <HomeSessao model={model} />,
    grade: <HomeGrade model={model} />,
  })
}
