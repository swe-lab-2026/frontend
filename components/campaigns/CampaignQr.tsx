"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import type { Campaign } from "@/lib/api/types";
import { campaignLink, discountLabel } from "@/lib/campaigns";
import { saveBlob } from "@/lib/download";
import { fmt, useI18n } from "@/lib/i18n/I18nProvider";

const WIDTH = 640;
const HEIGHT = 860;
// Purple frame + banner: admission tickets are plain black on white, so the two
// cannot be confused, even after the image has been downloaded and printed.
const PROMO = "#4c1d95";

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

type Poster = { link: string; banner: string; notTicket: string; title: string; discount: string };

async function drawPoster(canvas: HTMLCanvasElement, poster: Poster) {
  // Rendered from the server-issued link, which holds only an opaque token.
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, poster.link, { errorCorrectionLevel: "M", margin: 4, width: 520, color: { dark: PROMO, light: "#ffffff" } });

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const font = getComputedStyle(document.body).fontFamily;

  ctx.fillStyle = PROMO;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(16, 120, WIDTH - 32, HEIGHT - 136);

  ctx.textAlign = "center";
  ctx.font = `700 40px ${font}`;
  ctx.fillText(fitText(ctx, poster.banner, WIDTH - 48), WIDTH / 2, 56);
  ctx.font = `600 24px ${font}`;
  ctx.fillText(fitText(ctx, poster.notTicket, WIDTH - 48), WIDTH / 2, 96);

  ctx.drawImage(qr, (WIDTH - 520) / 2, 136, 520, 520);

  ctx.fillStyle = PROMO;
  ctx.font = `700 44px ${font}`;
  ctx.fillText(fitText(ctx, poster.discount, WIDTH - 80), WIDTH / 2, 716);
  ctx.fillStyle = "#151516";
  ctx.font = `600 26px ${font}`;
  ctx.fillText(fitText(ctx, poster.title, WIDTH - 80), WIDTH / 2, 766);
  ctx.fillStyle = "#5b6573";
  ctx.font = `400 18px ${font}`;
  ctx.fillText(fitText(ctx, new URL(poster.link).host, WIDTH - 80), WIDTH / 2, 808);
}

export function CampaignQr({ campaign, eventTitle }: { campaign: Campaign; eventTitle: string }) {
  const { t, intlLocale } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = campaignLink(campaign, window.location.origin);
  const discount = fmt(t.promo.discountOf, { discount: discountLabel(campaign.discount_type, campaign.discount_value, intlLocale) });
  const banner = t.campaigns.qrBanner;
  const notTicket = t.campaigns.qrNotTicket;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    drawPoster(canvas, { link, banner, notTicket, title: eventTitle, discount }).catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [link, banner, notTicket, eventTitle, discount]);

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (blob) saveBlob(blob, `biletflow-promo-${campaign.code ?? campaign.id}.png`);
      else setFailed(true);
    }, "image/png");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the link is shown as selectable text anyway.
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl bg-canvas p-5 sm:flex-row">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={fmt(t.campaigns.qrAlt, { name: campaign.name })}
        className="aspect-[640/860] w-full max-w-[240px] shrink-0 self-center rounded-xl sm:self-start"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Alert tone="warning">{t.campaigns.qrWarning}</Alert>
        {failed && <Alert tone="error">{t.common.unknownError}</Alert>}
        <p className="break-all font-mono text-[13px] text-ink-2">{link}</p>
        {!campaign.qr_url && <p className="text-[13px] text-muted">{t.campaigns.qrLocalLink}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>{t.campaigns.downloadQr}</Button>
          <Button variant="secondary" onClick={copy}>
            {copied ? t.campaigns.copied : t.campaigns.copyLink}
          </Button>
        </div>
      </div>
    </div>
  );
}
