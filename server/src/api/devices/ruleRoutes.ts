import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { isRuleIndex } from "../../domain/devices/ruleService.js";
import type { RuleService } from "../../domain/devices/ruleService.js";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
  index: z.coerce.number().int().refine(isRuleIndex, "Rule index must be 1, 2, or 3"),
});

const updateSchema = z.object({
  rule: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
});

export const ruleRoutes: FastifyPluginAsync<{ rules: RuleService }> = async (app, { rules }) => {
  app.get("/:id/rules/:index", async (request) => {
    const { id, index } = paramsSchema.parse(request.params);
    return rules.get(id, index);
  });

  app.put("/:id/rules/:index", async (request) => {
    const { id, index } = paramsSchema.parse(request.params);
    const { rule, enabled } = updateSchema.parse(request.body);

    if (rule !== undefined) await rules.setRule(id, index, rule);
    if (enabled !== undefined) await rules.setEnabled(id, index, enabled);
    return rules.get(id, index);
  });
};
