module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Fix for Windows Node v24 ENOENT: node:sea error
      // Bypass node:sea external shims by ignoring node: protocol imports
      [
        'module-resolver',
        {
          alias: {
            // Redirect node:sea to avoid Windows colon character restriction
            'node:sea': false,
          },
        },
      ],
    ],
    ignore: [/node_modules\/.*\/node:/],
  };
};
