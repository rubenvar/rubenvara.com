<script>
  import { fade } from 'svelte/transition';

  let showLong = $state(false);
</script>

<h2 class="section-title">Durante la década pasada...</h2>

<label for="toggler" class="theme-toggler">
  <input
    type="checkbox"
    id="toggler"
    class="checkbox"
    checked={showLong}
    onchange={() => (showLong = !showLong)}
  />
  <span aria-hidden="true" class="switch"></span>
  <span class={showLong ? 'text selected' : 'text'}> Versión extendida </span>
</label>

{#if showLong}
  <p transition:fade={{ duration: 200 }}>
    Estudié un grado en alternancia en el IMH, Elgoibar. Trabajé varios años
    como ingeniero industrial. Aprendí un monton muy grande sobre procesos
    comerciales y otras cosas.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Descubrí que <strong>no era así como quería vivir</strong>. Decidí cambiar
    mi vida por completo y abandonarlo todo. O intentarlo.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Me marché de viaje, con el vago plan de dar la vuelta al mundo. Me quedé por
    el camino.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Pasé <strong>tres años</strong> recorriendo el este de Europa y un poco más.
    Viví en varios países, creando mi negocio online, escalando, y conociendo cientos
    de personas maravillosas.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Volví a casa, para vivir en el monte alejado del ruido del mundo real. Para
    dedicar mi tiempo a estudiar, a escalar y a nadar casi a diario.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Y a trabajar en mi negocio online, donde diseño y desarrollo <strong
      >páginas y aplicaciones web modernas</strong
    > con tecnologías punteras. Suelo romper el Internet a menudo pero siempre consigo
    arreglarlo.
  </p>
{:else}
  <p transition:fade={{ duration: 200 }}>
    Estudié un grado. Trabajé varios años como ingeniero industrial. Decidí
    cambiar mi vida y abandonarlo todo.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Me marché de viaje, sin fechas ni planes. Pasé tres años viviendo en varios
    países, creando mi negocio online, escalando, y estudiando.
  </p>
  <p transition:fade={{ duration: 200 }}>
    Volví a casa, para vivir en el monte alejado del ruido. Para dedicar mi
    tiempo a estudiar, entrenar, y trabajar en mi negocio.
  </p>
{/if}

<style>
  label {
    /* props to Sara Soueidan (https://sarasoueidan.com) for the component design */
    position: relative;
    justify-self: end;
    transition: all 0.25s;
    color: var(--grey500);
    margin-bottom: 24px;
    &:hover {
      color: var(--primary500);
      .switch {
        border-color: var(--primary600);
      }
    }
    .text {
      font-size: var(--fz30);
      cursor: pointer;
      vertical-align: middle;
      transition: all 0.25s;
      &.selected {
        color: var(--primary500);
      }
    }
    .checkbox {
      opacity: 0;
      position: absolute;
      right: 0px;
      top: 25%;
      z-index: 1;
      &:focus + .switch {
        box-shadow:
          0 0 0 2px var(--white),
          0 0 0 4px var(--focus);
        outline: 3px solid transparent;
      }
      &:focus:not(:focus-visible) + .switch {
        box-shadow: none;
      }
      &:checked + .switch {
        background: var(--primary500);
        border-color: var(--primary800);
        &::after {
          transform: translatex(22.5px);
          border-color: #fff;
        }
      }
    }
    .switch {
      display: inline-block;
      width: 50px;
      height: 25px;
      border-radius: 12.5px;
      border: 2px solid #ddd;
      background: #eee;
      cursor: pointer;
      vertical-align: middle;
      overflow: hidden;
      margin: 0 5px;
      transition: all 0.25s;
      &::after {
        content: '';
        width: 21px;
        height: 21px;
        background: #fff;
        content: '';
        border-radius: 10.5px;
        position: absolute;
        margin-top: 0px;
        margin-left: 1px;
        border: 1px solid #eee;
        box-shadow: 0px 0px 10px -2px rgba(0, 0, 0, 0.2);
        transition: all 0.25s;
      }
    }
  }
</style>
