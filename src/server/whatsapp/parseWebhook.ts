import { z } from "zod";

const status = z.object({
  id: z.string(),
  status: z.string(),
  errors: z.array(z.object({ code: z.number().optional(), title: z.string().optional() })).optional(),
});

const message = z.looseObject({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  button: z.object({ text: z.string() }).optional(),
  interactive: z
    .looseObject({
      button_reply: z.object({ title: z.string() }).optional(),
      list_reply: z.object({ title: z.string() }).optional(),
    })
    .optional(),
});

export const whatsappWebhookSchema = z.object({
  entry: z.array(
    z.looseObject({
      changes: z.array(
        z.looseObject({
          value: z.looseObject({
            statuses: z.array(status).optional(),
            messages: z.array(message).optional(),
          }),
        }),
      ),
    }),
  ),
});

export type InboundMessage = z.infer<typeof message>;
export type StatusUpdate = z.infer<typeof status>;

export function messageText(m: InboundMessage): string | null {
  return (
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    null
  );
}
