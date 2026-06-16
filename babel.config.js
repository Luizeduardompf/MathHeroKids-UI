module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4: o plugin do Babel migrou para o pacote react-native-worklets.
    // Deve ser sempre o ÚLTIMO plugin da lista.
    plugins: ['react-native-worklets/plugin'],
  };
};
