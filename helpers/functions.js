import React, { useState } from "react";
import {
  Rested_4,
  Rested_1,
  Rayo,
  Rested_2,
  Rested_3,
  Rested_5,
  Rested_6,
  Rested_7,
  Rested_8,
  Rested_9,
  Rested_10,
} from "@/helpers/svg";

// -----------------------------
// 1. Componente CardLink
// -----------------------------
export const CardLink = ({ code, image }) => {
  const [hover, setHover] = useState(false);

  const handleClick = (e) => {
    e.preventDefault();
    window.open(
      "https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/ST10/ST10-001_EN.webp",
      "_blank"
    );
  };

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      style={{
        textDecoration: "underline",
        cursor: "pointer",
        color: "blue",
        position: "relative",
      }}
    >
      {code}
      {hover && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "0",
            background: "#fff",
            border: "1px solid #ccc",
            padding: "5px",
            zIndex: 10,
          }}
        >
          <img
            src={
              "https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/ST10/ST10-001_EN.webp"
            }
            alt={code}
            style={{ maxWidth: "200px", maxHeight: "200px" }}
          />
        </div>
      )}
    </span>
  );
};

// -----------------------------
// 2. Función para escapar caracteres
// -----------------------------
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// -----------------------------
// 3. Función para resaltar query
// -----------------------------
const highlightQuery = (text, query, keyPrefix) => {
  if (!query) return [text];
  const queryRegex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(queryRegex);
  return parts.map((part, idx) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span
        key={`${keyPrefix}-query-${idx}`}
        style={{ backgroundColor: "#fde047" }}
      >
        {part}
      </span>
    ) : (
      part
    )
  );
};

// -----------------------------
// 4. Función para aplicar itálicas
// -----------------------------
const applyItalics = (input, keyPrefix) => {
  if (typeof input === "string") {
    // Dividir el texto en partes usando paréntesis como separador
    const parts = input.split(/(\([^)]+\))/g);

    return parts.map((part, idx) => {
      // Verifica si la parte actual está entre paréntesis
      const isParenthesized = /^\([^)]+\)$/.test(part);

      // Extraer contenido dentro de los paréntesis sin los paréntesis
      const contentInside = part.slice(1, -1); // Elimina "(" y ")"

      // Solo aplicar itálicas si el contenido tiene más de una palabra
      if (isParenthesized && /\w+\s+\w+/.test(contentInside)) {
        return (
          <span
            key={`${keyPrefix}-italic-${idx}`}
            style={{ fontStyle: "italic", fontSize: "12px" }}
          >
            {part}
          </span>
        );
      }

      return part;
    });
  } else if (React.isValidElement(input)) {
    const children = input.props.children;

    if (typeof children === "string") {
      const newChildren = applyItalics(children, keyPrefix + "-child");
      return React.cloneElement(input, {
        key: keyPrefix,
        children: newChildren,
      });
    } else if (Array.isArray(children)) {
      const newChildren = children.map((child, idx) =>
        applyItalics(child, `${keyPrefix}-${idx}`)
      );
      return React.cloneElement(input, {
        key: keyPrefix,
        children: newChildren,
      });
    }
    return input;
  }

  return input;
};

// -----------------------------
// 5. Función para aplicar condiciones (bold)
// -----------------------------
// Distintas fuentes (scraper original, traducción ES) no siempre usan el
// mismo caracter de guion (p.ej. "DON!! -6" vs "DON!! −6" con signo menos),
// así que se normalizan todas las variantes de guion antes de armar el regex
// para que el match no dependa del caracter exacto guardado en `condition`.
const DASH_CHARS = "\\-\u2010\u2011\u2012\u2013\u2014\u2212";
const DASH_CLASS = `[${DASH_CHARS}]`;
const normalizeDashesForRegex = (escaped) =>
  escaped.replace(new RegExp(DASH_CLASS, "g"), DASH_CLASS);

const applyConditions = (text, conditions, keyPrefix) => {
  if (!conditions || conditions.length === 0) return [text];
  const conditionStrings = conditions
    .map((cond) => cond.condition)
    .filter(Boolean);
  if (conditionStrings.length === 0) return [text];

  const pattern = conditionStrings
    .map((cs) => normalizeDashesForRegex(escapeRegExp(cs)))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  // Con un único grupo de captura, `split` alterna texto/match/texto/match...,
  // así que las posiciones impares son siempre el match real (evita comparar
  // strings, que fallaría si el guion normalizado no es idéntico byte a byte).
  return parts.map((part, idx) => {
    const isCondition = idx % 2 === 1;
    if (isCondition) {
      return (
        <span key={`${keyPrefix}-cond-${idx}`} style={{ fontWeight: "bold" }}>
          {part}
        </span>
      );
    }
    return part;
  });
};

// -----------------------------
// 6. Función para detectar códigos de carta y aplicar CardLink
// -----------------------------
const applyCardLinks = (text, cardDatabase, keyPrefix) => {
  if (
    !text ||
    typeof text !== "string" ||
    !cardDatabase ||
    Object.keys(cardDatabase).length === 0
  ) {
    return [text];
  }
  const cardCodes = Object.keys(cardDatabase);
  const pattern = cardCodes.map((code) => escapeRegExp(code)).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "g");
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (cardDatabase[part]) {
      return (
        <CardLink
          key={`${keyPrefix}-card-${idx}`}
          code={part}
          image={cardDatabase[part]} // Se asume que cardDatabase tiene pares { código: URLimagen }
        />
      );
    }
    return part;
  });
};

// -----------------------------
// 7. Función principal highlightText
// Se le agregó un nuevo parámetro: cardDatabase (objeto con pares código-imagen)
// -----------------------------
export const highlightText = (
  text,
  query,
  conditions = [],
  cardDatabase = {}
) => {
  // Cada palabra de glosario (bracket-token) tiene su versión EN y su
  // traducción ES real (tal como la produce el traductor en
  // lib/cards/localization/translator.ts), mapeadas a la misma categoría
  // visual — así el estilo no depende del idioma que se esté mostrando.
  const GLOSSARY_TOKENS = [
    { en: "Rush", es: "Prisa", category: "diamond" },
    { en: "Blocker", es: "Bloqueador", category: "diamond" },
    { en: "Banish", es: "Desterrar", category: "diamond" },
    { en: "Double Attack", es: "Ataque doble", category: "diamond" },
    { en: "Your Turn", es: "Tu turno", category: "badge" },
    { en: "Activate: Main", es: "Activar: Principal", category: "badge" },
    { en: "On Play", es: "Al jugar", category: "badge" },
    { en: "When Attacking", es: "Al atacar", category: "badge" },
    { en: "Opponent's Turn", es: "Turno de tu oponente", category: "badge" },
    { en: "Main", es: "Principal", category: "badge" },
    { en: "On K.O.", es: "Al ser K.O.", category: "badge" },
    { en: "End of Your Turn", es: "Al final de tu turno", category: "badge" },
    { en: "On Block", es: "Al bloquear", category: "badge" },
    {
      en: "On Your Opponent's Attack",
      es: "Cuando tu oponente ataque",
      category: "badge",
    },
    { en: "DON!! x1", es: "DON!! ×1", category: "don" },
    { en: "DON!! x2", es: "DON!! ×2", category: "don" },
    { en: "Once Per Turn", es: "Una vez por turno", category: "once" },
    { en: "Counter", es: "Contraataque", category: "counter" },
    { en: "Trigger", es: "Activador", category: "trigger" },
  ];
  const tokenCategoryByLabel = new Map();
  GLOSSARY_TOKENS.forEach(({ en, es, category }) => {
    tokenCategoryByLabel.set(`[${en}]`.toLowerCase(), category);
    tokenCategoryByLabel.set(`[${es}]`.toLowerCase(), category);
  });
  const tokenRegex = new RegExp(
    `(${GLOSSARY_TOKENS.flatMap(({ en, es }) => [en, es])
      .map((label) => `\\[${escapeRegExp(label)}\\]`)
      .join("|")})`,
    "gi"
  );
  const parts = text?.split(tokenRegex);
  const result = [];

  parts?.forEach((part, index) => {
    if (part.match(tokenRegex)) {
      // (Procesamos los tokens como en tu código original)
      let tokenStyle = {
        display: "inline-flex",
        alignItems: "center",
        color: "white",
        fontWeight: "500",
        fontSize: "11px",
      };

      let tokenContent = part.replace("[", "").replace("]", "");
      const category = tokenCategoryByLabel.get(part.toLowerCase());

      if (category === "diamond") {
        tokenStyle.backgroundColor = "#e57223";
        tokenStyle.padding = "0px 8px";
        tokenStyle.display = "inline-block";
        tokenStyle.textAlign = "center";
        tokenStyle.clipPath =
          "polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)";
      } else if (category === "badge") {
        tokenStyle.backgroundColor = "#047699";
        tokenStyle.borderRadius = "0.25rem";
        tokenStyle.paddingLeft = "4px";
        tokenStyle.paddingRight = "4px";
      } else if (category === "don") {
        tokenStyle.backgroundColor = "#000000";
        tokenStyle.paddingLeft = "4px";
        tokenStyle.paddingRight = "4px";
        tokenStyle.clipPath =
          "polygon(10% 0%, 90% 0%, 100% 20%, 100% 80%, 90% 100%, 10% 100%, 0% 80%, 0% 20%)";
      } else if (category === "once") {
        tokenStyle.backgroundColor = "#ed4469";
        tokenStyle.borderRadius = "0.5rem";
        tokenStyle.paddingLeft = "4px";
        tokenStyle.paddingRight = "4px";
      } else if (category === "counter") {
        tokenStyle.backgroundColor = "#c20819";
        tokenStyle.borderRadius = "0.25rem";
        tokenStyle.paddingLeft = "1px";
        tokenStyle.paddingRight = "4px";
        tokenContent = (
          <>
            {React.cloneElement(Rayo, {
              key: `Rayo-${index}`,
              style: {
                display: "inline",
                verticalAlign: "middle",
                marginRight: "1px",
              },
            })}
            {tokenContent}
          </>
        );
      } else if (category === "trigger") {
        tokenStyle.backgroundColor = "#fee849";
        tokenStyle.clipPath = "polygon(0 0, 100% 0%, 80% 100%, 0% 100%)";
        tokenStyle.paddingLeft = "4px";
        tokenStyle.paddingRight = "10px";
        tokenStyle.paddingBottom = "2.5px";
        tokenStyle.color = "#000000";
        tokenStyle.fontWeight = "800";
      }

      result.push(
        <span key={`token-${index}`} style={tokenStyle}>
          {tokenContent}
        </span>
      );
    } else {
      // Para el resto del texto, buscamos los marcadores "//1" y "//4"
      const svgRegex =
        /(\/\/1|\/\/4|\/\/2|\/\/3|\/\/5|\/\/6|\/\/7|\/\/8|\/\/9|\/\/10)/g;
      const svgParts = part.split(svgRegex);

      svgParts.forEach((svgPart, svgIndex) => {
        if (svgPart === "//1") {
          result.push(
            React.cloneElement(Rested_1, {
              key: `Rested_1-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//4") {
          result.push(
            React.cloneElement(Rested_4, {
              key: `Rested_4-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//2") {
          result.push(
            React.cloneElement(Rested_2, {
              key: `Rested_2-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//3") {
          result.push(
            React.cloneElement(Rested_3, {
              key: `Rested_3-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//5") {
          result.push(
            React.cloneElement(Rested_5, {
              key: `Rested_5-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//6") {
          result.push(
            React.cloneElement(Rested_6, {
              key: `Rested_6-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//7") {
          result.push(
            React.cloneElement(Rested_7, {
              key: `Rested_7-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//8") {
          result.push(
            React.cloneElement(Rested_8, {
              key: `Rested_8-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else if (svgPart === "//9") {
          result.push(
            React.cloneElement(Rested_9, {
              key: `Rested_9-${index}-${svgIndex}`,
              style: { display: "inline", verticalAlign: "middle" },
            })
          );
        } else {
          // Primero se aplican las condiciones (para poner en bold)
          const conditionAppliedParts = applyConditions(
            svgPart,
            conditions,
            `${index}-${svgIndex}`
          );

          conditionAppliedParts.forEach((partCond, partCondIndex) => {
            if (typeof partCond === "string") {
              // Aquí aplicamos primero la detección de códigos de carta
              const cardLinkedParts = applyCardLinks(
                partCond,
                cardDatabase,
                `${index}-${svgIndex}-${partCondIndex}`
              );
              cardLinkedParts.forEach((cardPart, cardPartIndex) => {
                if (typeof cardPart === "string") {
                  // Luego se resalta el query
                  const highlighted = highlightQuery(
                    cardPart,
                    query,
                    `${index}-${svgIndex}-${partCondIndex}-${cardPartIndex}`
                  );
                  highlighted.forEach((node, qIndex) => {
                    const italicized = applyItalics(
                      node,
                      `${index}-${svgIndex}-${partCondIndex}-${cardPartIndex}-${qIndex}`
                    );
                    if (Array.isArray(italicized)) {
                      result.push(...italicized);
                    } else {
                      result.push(italicized);
                    }
                  });
                } else {
                  // Si ya es un componente CardLink, lo dejamos tal cual
                  result.push(cardPart);
                }
              });
            } else if (React.isValidElement(partCond)) {
              if (typeof partCond.props.children === "string") {
                const cardLinkedParts = applyCardLinks(
                  partCond.props.children,
                  cardDatabase,
                  `${index}-${svgIndex}-${partCondIndex}`
                );
                const newChildren = cardLinkedParts.map((child, qIndex) => {
                  if (typeof child === "string") {
                    const highlighted = highlightQuery(
                      child,
                      query,
                      `${index}-${svgIndex}-${partCondIndex}-${qIndex}`
                    );
                    return highlighted.map((node, hIndex) =>
                      applyItalics(
                        node,
                        `${index}-${svgIndex}-${partCondIndex}-${qIndex}-${hIndex}`
                      )
                    );
                  }
                  return child;
                });
                result.push(
                  React.cloneElement(partCond, {
                    key: `cond-${index}-${svgIndex}-${partCondIndex}`,
                    children: newChildren,
                  })
                );
              } else {
                result.push(
                  applyItalics(
                    partCond,
                    `cond-${index}-${svgIndex}-${partCondIndex}`
                  )
                );
              }
            }
          });
        }
      });

      // Agregar salto de línea si corresponde
      const trimmedPart = part.trim();
      if (trimmedPart.endsWith(".") || trimmedPart.endsWith(".)")) {
        result.push(<br key={`br-${index}`} />);
      }
    }
  });

  return result;
};

export const getColors = (color) => {
  switch (color.toLowerCase()) {
    case "red":
      return "#dd242e";
    case "green":
      return "#218f68";
    case "blue":
      return "#007ab1";
    case "yellow":
      return "#f2e847";
    case "black":
      return "#252323";
    case "purple":
      return "#953a8b";
    default:
      return "gray";
  }
};
