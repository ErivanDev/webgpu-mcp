/**
 * Retorna a hora atual.
 * @param {Object} params
 * @returns {string} Hora atual formatada.
 */
export function get_current_time(params = {}) {
  return new Date().toLocaleString();
}

export const GET_CURRENT_TIME_TOOL = {
  name: "get_current_time",
  description: "Returns the current date and time.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: get_current_time,
};


/**
 * Soma dois números.
 * @param {Object} params
 * @param {number} params.a - Primeiro número.
 * @param {number} params.b - Segundo número.
 * @returns {number} Resultado da soma.
 */
export function sum_numbers({ a, b }) {
  return Number(a) + Number(b);
}

export const SUM_NUMBERS_TOOL = {
  name: "sum_numbers",
  description: "Adds two numbers together.",
  parameters: {
    type: "object",
    properties: {
      a: {
        type: "number",
        description: "First number",
      },
      b: {
        type: "number",
        description: "Second number",
      },
    },
    required: ["a", "b"],
  },
  execute: sum_numbers,
};


/**
 * Gera um número aleatório.
 * @param {Object} params
 * @param {number} params.min - Valor mínimo.
 * @param {number} params.max - Valor máximo.
 * @returns {number} Número aleatório.
 */
export function random_number({ min = 0, max = 100 } = {}) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const RANDOM_NUMBER_TOOL = {
  name: "random_number",
  description: "Generates a random number between min and max.",
  parameters: {
    type: "object",
    properties: {
      min: {
        type: "number",
        description: "Minimum value",
      },
      max: {
        type: "number",
        description: "Maximum value",
      },
    },
  },
  execute: random_number,
};