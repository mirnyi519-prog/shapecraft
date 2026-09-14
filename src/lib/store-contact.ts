export const STORE_PHONE_DISPLAY = "+7 (963) 668-82-78";
export const STORE_PHONE_TEL = "+79636688278";
/** Цифры без + для wa.me */
export const STORE_WHATSAPP_NUMBER = "79636688278";

export const STORE_PHONE_HINT =
  "Уточнить наличие, заказать или договориться о встрече";

export const PICKUP_MAPS_URL =
  "https://yandex.ru/maps/org/u_svetlany/232447380240/?ll=36.954661%2C55.184921&z=16";

export const PICKUP_MAP_WIDGET_URL =
  "https://yandex.ru/map-widget/v1/?ll=36.954661%2C55.184921&z=16&pt=36.954661,55.184921,pm2rdm&l=map";

export const PICKUP_TITLE = "Пекарня «У Светланы»";

export function buildWhatsAppUrl(productName?: string): string {
  const text = productName?.trim()
    ? `Здравствуйте! Интересует «${productName.trim()}» из ShapeCraft. Подскажите, есть ли в наличии и как забрать в пекарне?`
    : "Здравствуйте! Пишу по ShapeCraft — хочу уточнить наличие и встречу в пекарне.";

  return `https://wa.me/${STORE_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
