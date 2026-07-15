export type UserGuideSection = {
  heading: string;
  body?: string;
  items?: string[];
  steps?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
};

export type UserGuidePage = {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  sections: UserGuideSection[];
  tips?: string[];
  related?: { label: string; href: string }[];
};

export {
  USER_GUIDE_PAGES,
  USER_GUIDE_BY_SLUG,
  userGuideSlugs,
  userGuideBySlug,
} from "@/lib/docs/handbuch";
