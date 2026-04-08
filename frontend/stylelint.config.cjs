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
  },
};
