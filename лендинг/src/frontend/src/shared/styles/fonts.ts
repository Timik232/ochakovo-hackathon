/*
 * Self-hosted Montserrat (пакет @fontsource/montserrat).
 * Импортируем только нужные начертания и только кириллицу + латиницу:
 * внешних CDN-запросов в рантайме нет (Visual Contract: никаких сторонних шрифтов).
 * 500 — основной текст, 700/800 — подписи полей и навигация, 900 — комикс-заголовки и кнопки.
 */
import "@fontsource/montserrat/cyrillic-500.css";
import "@fontsource/montserrat/cyrillic-700.css";
import "@fontsource/montserrat/cyrillic-800.css";
import "@fontsource/montserrat/cyrillic-900.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
