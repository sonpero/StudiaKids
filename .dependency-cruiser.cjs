/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-deep-module-import",
      comment:
        "Cross-module imports must go through the other module's index.ts, never its internals (CLAUDE.md).",
      severity: "error",
      from: {
        path: "^packages/core/src/([^/]+)/",
      },
      to: {
        path: "^packages/core/src/([^/]+)/(?!index\\.ts$).+",
        pathNot: "^packages/core/src/$1/",
      },
    },
    {
      name: "domain-is-pure",
      comment:
        "domain/** must have zero I/O: no importing application/**, infra/**, or any package that does I/O (CLAUDE.md).",
      severity: "error",
      from: {
        path: "^packages/core/src/[^/]+/domain/",
      },
      to: {
        path: "^packages/core/src/[^/]+/(application|infra)/",
      },
    },
    {
      name: "no-circular-dependency",
      comment:
        "No import cycle, anywhere: two modules that must each load before the other can is exactly the coupling this repo's module-per-domain design (CLAUDE.md) rules out.",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "frozen-kernels",
      comment:
        "jobs/** and shared/** are frozen kernels: they must not import any business module (CLAUDE.md).",
      severity: "error",
      from: {
        path: "^packages/core/src/(jobs|shared)/",
      },
      to: {
        path: "^packages/core/src/(?!jobs/|shared/)[^/]+/",
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    exclude: {
      path: "\\.(unit|int|contract)\\.test\\.tsx?$",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default"],
    },
  },
};
