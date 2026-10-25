import bottle from "./bottle.png";
import can from "./can.png";
import crate from "./crate.png";
import funnel from "./funnel.png";
import hops from "./hops.png";
import kettle from "./kettle.png";
import tank from "./tank.png";
import wheat from "./wheat.png";

/*
 * Бренд-иконки позиций из прототипа v4 (img/), предоставлены владельцем проекта.
 * logo.png сознательно НЕ переносим: шапка использует текстовую идентификацию
 * «ОЧАКОВО / КАДРЫ», официальный логотип не подтверждён (Visual Contract).
 */
export const brandIcons = {
  bottle,
  can,
  crate,
  funnel,
  hops,
  kettle,
  tank,
  wheat,
} as const;

export type BrandIconName = keyof typeof brandIcons;
