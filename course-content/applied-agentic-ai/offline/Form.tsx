import type { ComponentProps, SyntheticEvent } from "react";

/** Local demo forms must work without granting native form/network navigation. */
export default function OfflineForm(props: ComponentProps<"form">) {
  const submit = (event: SyntheticEvent<HTMLFormElement>, submitter?: HTMLButtonElement | HTMLInputElement) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.reportValidity()) form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter }));
  };
  return <form {...props} onClickCapture={event => {
    props.onClickCapture?.(event);
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement | HTMLInputElement>('button,input');
    if (!event.defaultPrevented && button?.type === 'submit' && button.form === event.currentTarget) submit(event, button);
  }} onKeyDownCapture={event => {
    props.onKeyDownCapture?.(event);
    if (!event.defaultPrevented && event.key === "Enter" && event.target instanceof HTMLInputElement) submit(event);
  }} />;
}
