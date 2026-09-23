import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignController } from './DesignController'
import { SafeStorage } from './SafeStorage'

describe('DesignController', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.design
  })

  it('sem escolha salva, é a Brasa', () => {
    const controller = new DesignController()
    expect(controller.current).toBe('brasa')
    controller.apply()
    expect(document.documentElement.dataset.design).toBe('brasa')
  })

  it('guarda a escolha, aplica no <html> e avisa quem desenha', () => {
    const controller = new DesignController()
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.set('grade')

    expect(localStorage.getItem(DesignController.KEY)).toBe('grade')
    expect(document.documentElement.dataset.design).toBe('grade')
    expect(listener).toHaveBeenCalledOnce()
    // Outra instância (outra aba, recarga) lê a mesma escolha.
    expect(new DesignController().current).toBe('grade')
  })

  it('voltar ao padrão apaga a chave em vez de gravar "brasa"', () => {
    const controller = new DesignController()
    controller.set('sessao')
    controller.set('brasa')
    expect(localStorage.getItem(DesignController.KEY)).toBeNull()
  })

  it('valor desconhecido (design removido, chave editada à mão) cai no padrão', () => {
    localStorage.setItem(DesignController.KEY, 'neon')
    expect(new DesignController().current).toBe('brasa')
  })

  it('sem armazenamento (janela privada), a troca vale na aba — só não sobrevive à recarga', () => {
    const controller = new DesignController(new SafeStorage(null))
    controller.set('sessao')
    expect(controller.current).toBe('sessao')
    expect(document.documentElement.dataset.design).toBe('sessao')
    expect(new DesignController(new SafeStorage(null)).current).toBe('brasa')
  })
})
