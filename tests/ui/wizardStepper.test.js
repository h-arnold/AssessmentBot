const WizardStepper = require('../../src/AdminSheet/UI/Stepper.js');

describe('WizardStepper', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="stepper-root"></div>';
    container = document.getElementById('stepper-root');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders steps and marks the current step', () => {
    new WizardStepper(container, {
      steps: [{ label: 'First' }, { label: 'Second' }, { label: 'Third' }],
      currentStep: 1,
    });

    const spans = container.querySelectorAll('span[data-step-index]');
    expect(spans.length).toBe(3);
    const active = container.querySelector('span[aria-current="step"]');
    expect(active).not.toBeNull();
    expect(active.dataset.stepIndex).toBe('1');
    expect(active.classList.contains('primary')).toBe(true);
    const disabled = container.querySelector('span[aria-disabled="true"]');
    // Step 2 (index 2) is after current; should be disabled
    expect(disabled.dataset.stepIndex).toBe('2');
  });

  it('setCurrent updates DOM classes and aria attributes', () => {
    const s = new WizardStepper(container, {
      steps: [{ label: 'A' }, { label: 'B' }],
      currentStep: 0,
    });
    s.setCurrent(1);
    const active = container.querySelector('span[aria-current="step"]');
    expect(active.dataset.stepIndex).toBe('1');
    const first = container.querySelector('span[data-step-index="0"]');
    expect(first.classList.contains('muted')).toBe(true);
  });

  it('addStep and removeStep mutate the steps and update DOM', () => {
    const s = new WizardStepper(container, {
      steps: [{ label: 'X' }],
      currentStep: 0,
    });
    s.addStep('Y');
    expect(container.querySelectorAll('span[data-step-index]').length).toBe(2);
    s.addStep('Z', 1);
    expect(container.querySelectorAll('span[data-step-index]').length).toBe(3);
    // remove middle
    s.removeStep(1);
    expect(container.querySelectorAll('span[data-step-index]').length).toBe(2);
  });

  it('enableStep toggles aria-disabled', () => {
    const s = new WizardStepper(container, {
      steps: [{ label: 'one' }, { label: 'two' }],
      currentStep: 0,
    });
    // Step 1 initially disabled (index 1 > current)
    const step1 = container.querySelector('span[data-step-index="1"]');
    expect(step1.getAttribute('aria-disabled')).toBe('true');
    s.enableStep(1, true);
    expect(step1.getAttribute('aria-disabled')).toBe('false');
    s.enableStep(1, false);
    expect(step1.getAttribute('aria-disabled')).toBe('true');
  });

  it('invokes onChange when clicking an enabled step and not when disabled', () => {
    const onChange = vi.fn();
    const s = new WizardStepper(container, {
      steps: [{ label: 'one' }, { label: 'two' }, { label: 'three' }],
      currentStep: 0,
      onChange,
    });

    // make step 2 enabled (index 1)
    s.enableStep(1, true);
    const step1 = container.querySelector('span[data-step-index="1"]');
    step1.click();
    expect(onChange).toHaveBeenCalledWith(1);

    // disable step 2 and verify no-call
    onChange.mockClear();
    s.enableStep(1, false);
    step1.click();
    expect(onChange).not.toHaveBeenCalled();
  });
});
