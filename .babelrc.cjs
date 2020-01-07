const presets = [
	["@babel/preset-env", { "debug": !!process.env.DEBUG || false, "corejs": 3, "useBuiltIns": "usage" }],
];

module.exports = { presets };
