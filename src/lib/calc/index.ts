/**
 * Motor de cálculos de Pulso. Funciones puras: sin UI, sin base de datos,
 * sin fecha "de hoy" implícita. Todo lo que dependa del tiempo recibe la
 * fecha como parámetro, para que los tests sean deterministas.
 */
export * from "./bmr";
export * from "./constants";
export * from "./daily-targets";
export * from "./dates";
export * from "./energy";
export * from "./goals";
export * from "./nutrition";
export * from "./trend";
export * from "./activity";
export * from "./types";
