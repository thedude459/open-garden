module.exports = {
  extends: ["stylelint-config-standard"],
  rules: {
    // Keep strict quality checks, but relax opinionated style rules that would
    // require broad non-functional rewrites of existing project CSS.
    "import-notation": null,
    "font-family-name-quotes": null,
    "color-function-alias-notation": null,
    "color-function-notation": null,
    "alpha-value-notation": null,
    "color-hex-length": null,
    "media-feature-range-notation": null,
    "declaration-block-single-line-max-declarations": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "rule-empty-line-before": null,
    "no-descending-specificity": null,
    // Allow BEM-style class selectors (block__element and block--modifier)
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:(?:__|--)[a-z0-9]+(?:-[a-z0-9]+)*)*$",
      { message: "Expected class selector to be kebab-case with optional BEM __element/--modifier suffixes" },
    ],
  },
};
