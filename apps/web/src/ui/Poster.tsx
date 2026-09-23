import { useState } from 'react'
import { type PosterSize, TmdbImage } from '@/domain/TmdbImage'
import { cn } from './cn'

interface PosterProps {
  path: string | null | undefined
  name: string
  size?: PosterSize
  /** Largura na tela, para o navegador escolher do srcset. */
  sizes?: string
  className?: string
  eager?: boolean
}

/**
 * Pôster 2:3. Sem imagem (série só do export, ainda sem metadados) vira uma capa tipográfica com
 * o nome — melhor do que um retângulo cinza, que parece erro de carregamento.
 */
export function Poster({ path, name, size = 'w185', sizes = '160px', className, eager = false }: PosterProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const src = TmdbImage.url(path, size)
  const showImage = src && !failed

  return (
    <div className={cn('relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-3', className)}>
      {showImage ? (
        <img
          src={src}
          srcSet={TmdbImage.posterSrcSet(path, size)}
          sizes={sizes}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn('size-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : (
        <div className="flex size-full flex-col justify-end bg-gradient-to-br from-surface-3 to-surface-2 p-2.5">
          <span className="headline line-clamp-4 text-[clamp(11px,14cqw,20px)] text-ink-2 [container-type:inline-size]">
            {name}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/5 ring-inset dark:ring-white/5" />
    </div>
  )
}
