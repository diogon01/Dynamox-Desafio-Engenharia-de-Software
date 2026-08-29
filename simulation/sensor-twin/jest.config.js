/**
 * Unitários do gêmeo (src/**): puros — sem rede, sem banco, sem ROS — e por isso
 * seguros na suíte global. A integração contra a API viva mora em test/ e só roda
 * pelo script dedicado test:integration (nunca no target test padrão).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  // Ancorado no rootDir do pacote, NUNCA em substring do caminho absoluto do clone:
  // um repositório clonado sob ~/src/... não pode arrastar a integração para cá.
  testPathIgnorePatterns: ['<rootDir>/test/', '/node_modules/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 30000,
};
