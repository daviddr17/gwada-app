"use client";

import type { ImgHTMLAttributes } from "react";

/** Vite-Stub — Dashboard nutzt kein Next Image-Optimizer. */
export default function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
  const { src, alt, className, width, height, style, ...rest } = props;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      className={className}
      width={width}
      height={height}
      style={style}
      {...rest}
    />
  );
}
