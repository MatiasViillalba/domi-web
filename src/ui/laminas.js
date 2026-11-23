const galeria = document.querySelector('.galeria-laminas');
const visor = document.querySelector('#visor-lamina');
const titulo = document.querySelector('#titulo-visor-lamina');
const pdf = document.querySelector('#pdf-lamina');
const descargar = document.querySelector('#descargar-lamina');

galeria.addEventListener('click', (evento) => {
  const lamina = evento.target.closest('a.lamina');
  if (!lamina || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

  evento.preventDefault();
  const nombre = lamina.querySelector('strong').textContent;
  titulo.textContent = nombre;
  pdf.title = nombre;
  descargar.href = lamina.href;
  pdf.src = `${lamina.href}#view=FitH`;
  visor.showModal();
});

visor.addEventListener('close', () => pdf.removeAttribute('src'));
