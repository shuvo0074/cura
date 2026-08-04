/**
 * Reproduces the reported bug against a real DOM.
 *
 * react-test-renderer does not simulate StrictMode's mount -> unmount ->
 * remount cycle; react-dom/client in development does. web/src/main.tsx mounts
 * the app inside <StrictMode>, so that is the environment the bug lives in.
 */
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.IS_REACT_ACT_ENVIRONMENT = true;

const _err = console.error;
console.error = (...a) => _err('        [react]', String(a[0]).split('\n')[0].slice(0, 160));
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react');
const { ViewModel, useViewModel } = require('./packages/shared/dist/cjs/index.js');

class FieldViewModel extends ViewModel {
  constructor() {
    super({ text: '' });
    this.calls = 0;
  }
  setText(value) {
    this.calls += 1;
    this.setState({ text: value, fieldErrors: {}, formError: null });
  }
}

function Field({ report }) {
  const [state, vm] = useViewModel(() => new FieldViewModel());
  report(vm);
  return React.createElement('input', {
    id: 'probe',
    value: state.text,
    onChange: (e) => vm.setText(e.target.value),
  });
}

// Drive the ViewModel exactly as the onChange handler would. This isolates
// the question under test: does a ViewModel update still reach the DOM after
// StrictMode has mounted, unmounted and remounted the component?

function run(label, wrap) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let vm = null;
  const root = createRoot(host, {
    onRecoverableError: (e) => console.log('        [recoverable]', e && e.message),
  });

  try {
    act(() => { root.render(wrap(React.createElement(Field, { report: (v) => (vm = v) }))); });
  } catch (e) {
    console.log('        [render threw]', e && e.message);
  }
  console.log('        html after mount:', JSON.stringify(host.innerHTML));
  try {
    act(() => { vm.setText('Str0ngPassphrase'); });
  } catch (e) {
    console.log('        [update threw]', e && e.message.split('\n')[0]);
  }
  console.log('        html after update:', JSON.stringify(host.innerHTML));

  const el = host.querySelector('input');
  const shown = el ? el.value : '<gone>';
  const ok = shown === 'Str0ngPassphrase';
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  console.log(`        handler ran ${vm.calls}x | vm.state.text=${JSON.stringify(vm.state.text)} | input shows ${JSON.stringify(shown)}`);
  return ok;
}

console.log('\ntyping into a controlled ViewModel-backed input:\n');
const plain = run('plain render', (el) => el);
const strict = run('inside <StrictMode>  (how main.tsx mounts the app)',
  (el) => React.createElement(React.StrictMode, null, el));
console.log();
process.exit(plain && strict ? 0 : 1);
