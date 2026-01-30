/**
 * WizardStepper
 * Small, framework-agnostic stepper controller (DOM-friendly) for wizard footers.
 * Designed to be importable in tests and included as a classic script in HTML dialogs.
 */
class WizardStepper {
  /**
   * @param {Element|string} container - Element or selector to render into (replaces content)
   * @param {Object} opts - Options
   * @param {Array<{label:string}>} opts.steps - Steps array
   * @param {number} opts.currentStep - 0-based current step index
   * @param {function(number):void} opts.onChange - callback when user selects a step
   */
  constructor(container, { steps = [], currentStep = 0, onChange = () => {} } = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.steps = steps.slice();
    this.currentStep = Number(currentStep) || 0;
    this.onChange = onChange;

    this._handleClick = this._handleClick.bind(this);
    this.render();
  }

  render() {
    // clear container
    this.container.innerHTML = '';

    const nav = document.createElement('nav');
    nav.className = 'wizard-stepper';
    nav.setAttribute('aria-label', 'Wizard steps');

    const ol = document.createElement('ol');
    ol.style.listStyle = 'none';
    ol.style.padding = '0';
    ol.style.margin = '0';
    ol.className = 'horizontal center-align';

    this.steps.forEach((step, i) => {
      const li = document.createElement('li');
      li.style.display = 'inline-block';
      li.style.margin = '0 1.5rem 0 0';
      li.style.verticalAlign = 'middle';

      const span = document.createElement('span');
      span.className =
        `circle small ${i === this.currentStep ? 'primary' : i < this.currentStep ? 'muted' : ''}`.trim();
      span.setAttribute('data-step-index', String(i));
      if (i === this.currentStep) span.setAttribute('aria-current', 'step');
      if (i > this.currentStep) span.setAttribute('aria-disabled', 'true');
      span.tabIndex = i > this.currentStep ? -1 : 0;
      span.textContent = String(i + 1);

      const labelDiv = document.createElement('div');
      labelDiv.className = 'small-margin';
      labelDiv.style.textAlign = 'center';
      labelDiv.style.fontSize = '0.95em';
      labelDiv.style.marginTop = '0.25rem';
      labelDiv.textContent = step.label || '';

      li.appendChild(span);
      li.appendChild(labelDiv);
      ol.appendChild(li);

      if (i < this.steps.length - 1) {
        const sepLi = document.createElement('li');
        sepLi.style.display = 'inline-block';
        sepLi.style.verticalAlign = 'middle';
        sepLi.style.margin = '0 0.5rem';
        const divider = document.createElement('span');
        divider.className = 'divider';
        divider.style.display = 'inline-block';
        divider.style.width = '2.5rem';
        divider.style.height = '2px';
        divider.style.background = 'var(--outline-variant, #ccc)';
        divider.style.verticalAlign = 'middle';
        sepLi.appendChild(divider);
        ol.appendChild(sepLi);
      }
    });

    nav.appendChild(ol);

    this.container.appendChild(nav);

    // attach handler to clickable spans
    nav.removeEventListener('click', this._handleClick);
    nav.addEventListener('click', this._handleClick);

    this._nav = nav;
  }

  _handleClick(e) {
    const target = e.target.closest('span[data-step-index]');
    if (!target) return;
    const index = Number(target.getAttribute('data-step-index'));
    const disabled = target.getAttribute('aria-disabled') === 'true';
    if (disabled) return;
    this.setCurrent(index);
    this.onChange(index);
  }

  setSteps(steps) {
    this.steps = steps.slice();
    if (this.currentStep >= this.steps.length)
      this.currentStep = Math.max(0, this.steps.length - 1);
    this.render();
  }

  addStep(label, index) {
    if (typeof index === 'number') this.steps.splice(index, 0, { label });
    else this.steps.push({ label });
    this.render();
  }

  removeStep(index) {
    this.steps.splice(index, 1);
    if (this.currentStep >= this.steps.length)
      this.currentStep = Math.max(0, this.steps.length - 1);
    this.render();
  }

  setCurrent(index) {
    this.currentStep = Number(index);
    // update DOM in place to keep references
    const spans = Array.from(this._nav.querySelectorAll('span[data-step-index]'));
    spans.forEach((span) => {
      const i = Number(span.getAttribute('data-step-index'));
      span.classList.toggle('primary', i === this.currentStep);
      span.classList.toggle('muted', i < this.currentStep);
      if (i === this.currentStep) span.setAttribute('aria-current', 'step');
      else span.removeAttribute('aria-current');
      if (i > this.currentStep) {
        span.setAttribute('aria-disabled', 'true');
        span.tabIndex = -1;
      } else {
        span.setAttribute('aria-disabled', 'false');
        span.tabIndex = 0;
      }
    });
  }

  enableStep(index, enabled) {
    const span = this._nav.querySelector(`span[data-step-index="${index}"]`);
    if (!span) return;
    if (enabled) span.setAttribute('aria-disabled', 'false');
    else span.setAttribute('aria-disabled', 'true');
  }

  destroy() {
    if (this._nav) this._nav.removeEventListener('click', this._handleClick);
    if (this.container) this.container.innerHTML = '';
    this._nav = null;
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) module.exports = WizardStepper;

// Attach to global for browser usage (classical script)
if (typeof window !== 'undefined') {
  // Note: not overwriting if already present
  if (!window.WizardStepper) window.WizardStepper = WizardStepper;
}
