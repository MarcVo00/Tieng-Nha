/** What every signature scene receives: `onEnd` when it has played (the piece then appears), and reduced motion. */
export type SignatureProps = { onEnd: () => void; reduced: boolean };
