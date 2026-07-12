export type ClusterableParameter = {
  id: string;
  subCode: string;
  name: string;
  maxValue: number;
  rubricAnchors: unknown;
  clusterLabel: string | null;
  order: number;
};

export type ParameterCluster = {
  key: string;
  label: string;
  parameterIds: string[];
  maxValue: number;
  rubricAnchors: unknown;
  order: number;
};

/**
 * Groups parameters sharing the same clusterLabel into ONE mentor-facing
 * input ("Rumpun Penilaian") — call this with one material's own parameter
 * list at a time (cluster labels are only unique within a material, not
 * globally). A parameter with clusterLabel: null stands alone, keyed by its
 * own id — this is what every parameter did before clustering existed, so
 * nothing regresses for materials that don't need it (e.g. Mars Electics,
 * the 4 skill categories).
 */
export function groupByCluster(parameters: ClusterableParameter[]): ParameterCluster[] {
  const clusters = new Map<string, ParameterCluster>();

  for (const param of parameters) {
    const key = param.clusterLabel ? `cluster:${param.clusterLabel}` : `param:${param.id}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.parameterIds.push(param.id);
      existing.order = Math.min(existing.order, param.order);
    } else {
      clusters.set(key, {
        key,
        label: param.clusterLabel ?? param.name,
        parameterIds: [param.id],
        maxValue: param.maxValue,
        rubricAnchors: param.rubricAnchors,
        order: param.order,
      });
    }
  }

  return Array.from(clusters.values()).sort((a, b) => a.order - b.order);
}
