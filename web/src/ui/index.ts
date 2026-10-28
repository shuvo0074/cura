/**
 * Shared UI kit.
 *
 * One component per file; this barrel is the single import site so a feature
 * never reaches into another feature for a primitive. `uiStyles` is exported
 * alongside because screens style their own inputs and tables with the same
 * classes the primitives use.
 */
export { Panel } from './Panel';
export { Field } from './Field';
export { Row } from './Row';
export { Check } from './Check';
export { SaveBar } from './SaveBar';
export { Modal } from './Modal';
export { ModalActions } from './ModalActions';
export { Metric } from './Metric';
export { Loading } from './Loading';
export { Failed } from './Failed';
export { PatientPicker, type PickedPatient } from './PatientPicker';
export { useResource } from './use-resource';
export { useMutation } from './use-mutation';
export { default as uiStyles } from './ui.module.css';
