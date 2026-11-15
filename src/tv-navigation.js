const MENU_IDLE = 4500;
const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function tvNavigation(root, activeTab, goBack) {
  let timer;
  const menu = () => root.querySelector('.tv-menu');
  const focus = button => button?.focus({preventScroll:true});

  function hide() {
    clearTimeout(timer);
    const nav = menu();
    if (!nav) return;
    if (nav.contains(document.activeElement)) document.activeElement.blur();
    nav.hidden = true;
  }

  function show() {
    const nav = menu();
    if (!nav || activeTab() !== 'ambient') return;
    nav.hidden = false;
    if (activeTab() === 'ambient') {
      clearTimeout(timer);
      timer = setTimeout(hide, MENU_IDLE);
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'BrowserBack') {
      event.preventDefault();
      goBack();
      return;
    }
    const inField = event.target instanceof HTMLInputElement;
    const direction = arrows.indexOf(event.key);
    if(inField&&(direction===2||direction===3||direction<0))return;
    const select = event.key === 'Enter' || event.key === ' ';
    if (direction < 0 && !select) return;
    const nav = menu();
    if (activeTab() === 'ambient' && nav?.hidden) {
      event.preventDefault();
      if (!event.repeat) {
        show();
        focus(nav.querySelector('[data-tab="calendar"]'));
      }
      return;
    }
    show();
    if (direction < 0) {
      if (event.repeat) event.preventDefault();
      return;
    }
    event.preventDefault();

    const rows = [
      [...root.querySelectorAll('.tv-menu:not([hidden]) button')],
      [...root.querySelectorAll('.period button')],
      [...root.querySelectorAll('.segments button')],
      [...root.querySelectorAll('.week-day')],
      ...[...root.querySelectorAll('.signin input,.signin button')].map(element=>[element]),
    ].filter(row => row.length);
    const cells = [...root.querySelectorAll('.month-grid [data-day]')];
    for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));

    const current = document.activeElement;
    const rowIndex = rows.findIndex(row => row.includes(current));
    if (rowIndex < 0) {
      focus(rows[0]?.[0]);
      return;
    }
    const row = rows[rowIndex];
    const column = row.indexOf(current);
    if (direction >= 2) {
      focus(row[column + (direction === 2 ? -1 : 1)]);
      return;
    }
    if (activeTab() === 'calendar' && !cells.length && rowIndex === rows.length - 1 &&
        (direction === 1 || window.scrollY > 0)) {
      window.scrollBy(0, direction === 0 ? -150 : 150);
      return;
    }
    const nextRow = rows[rowIndex + (direction === 0 ? -1 : 1)];
    if (!nextRow) return;
    const center = element => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    };
    const x = center(current);
    const nearest = nextRow.reduce((best, button) =>
      Math.abs(center(button) - x) < Math.abs(center(best) - x) ? button : best);
    nearest.focus();
  });

  root.addEventListener('pointermove', () => {
    if (activeTab() === 'ambient') show();
  });
  root.addEventListener('pointerdown', () => {
    if (activeTab() === 'ambient') show();
  });
  window.addEventListener('calendar-native-back', goBack);
  return {hide};
}
