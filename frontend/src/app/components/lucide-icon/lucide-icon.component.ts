import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LayoutGrid, TrendingUp, TrendingDown, PieChart, Tag, BarChart3,
  Users, Settings, LogOut, Plus, Wallet, ArrowDownCircle, Scale,
  Coins, Calendar, CheckCircle, TriangleAlert, Clock, ChevronDown,
  ChevronLeft, ChevronRight, RefreshCw, BellRing, Utensils, Car,
  Home, Zap, Wifi, HeartPulse, GraduationCap, Clapperboard, Shirt,
  ShoppingBag, Plane, PawPrint, ShieldCheck, Landmark, PiggyBank,
  Package, Banknote, Search, Pencil, Trash2, Receipt, User, Check,
  Eye, EyeOff, Download, Filter, History, FileText, ChartLine,
  ArrowUpRight, ArrowDownRight, ArrowRight, CircleDollarSign,
  Save, UserRound, UserRoundCheck, UserPlus, BadgeCheck,
  ClipboardCheck, WalletCards, CalendarDays, CircleArrowDown,
  ChartNoAxesCombined, Mail, Globe, Monitor, Shield, CreditCard,
  Lightbulb, TrendingUpDown, Send, LogIn, Gift, Wrench, X, Info,
  Camera, GripHorizontal, Lock,
} from 'lucide';

const ICON_MAP: Record<string, any[]> = {
  'layout-grid': LayoutGrid,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'pie-chart': PieChart,
  'tag': Tag,
  'bar-chart-3': BarChart3,
  'users': Users,
  'settings': Settings,
  'log-out': LogOut,
  'plus': Plus,
  'wallet': Wallet,
  'arrow-down-circle': ArrowDownCircle,
  'scale': Scale,
  'coins': Coins,
  'calendar': Calendar,
  'check-circle': CheckCircle,
  'triangle-alert': TriangleAlert,
  'clock': Clock,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'refresh-cw': RefreshCw,
  'bell-ring': BellRing,
  'utensils': Utensils,
  'car': Car,
  'home': Home,
  'zap': Zap,
  'wifi': Wifi,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'clapperboard': Clapperboard,
  'shirt': Shirt,
  'shopping-bag': ShoppingBag,
  'plane': Plane,
  'paw-print': PawPrint,
  'shield-check': ShieldCheck,
  'landmark': Landmark,
  'piggy-bank': PiggyBank,
  'package': Package,
  'banknote': Banknote,
  'search': Search,
  'pencil': Pencil,
  'trash-2': Trash2,
  'receipt': Receipt,
  'user': User,
  'check': Check,
  'eye': Eye,
  'eye-off': EyeOff,
  'download': Download,
  'filter': Filter,
  'history': History,
  'file-text': FileText,
  'chart-line': ChartLine,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'arrow-right': ArrowRight,
  'circle-dollar-sign': CircleDollarSign,
  'save': Save,
  'user-round': UserRound,
  'user-round-check': UserRoundCheck,
  'user-plus': UserPlus,
  'badge-check': BadgeCheck,
  'clipboard-check': ClipboardCheck,
  'wallet-cards': WalletCards,
  'calendar-days': CalendarDays,
  'circle-arrow-down': CircleArrowDown,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'mail': Mail,
  'globe': Globe,
  'monitor': Monitor,
  'shield': Shield,
  'credit-card': CreditCard,
  'lightbulb': Lightbulb,
  'trending-up-down': TrendingUpDown,
  'send': Send,
  'log-in': LogIn,
  'gift': Gift,
  'wrench': Wrench,
  'x': X,
  'info': Info,
  'camera': Camera,
  'grip-horizontal': GripHorizontal,
  'lock': Lock,
};

@Component({
  selector: 'lucide-icon',
  standalone: true,
  imports: [CommonModule],
  template: `<svg #svgEl xmlns="http://www.w3.org/2000/svg" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`,
  styles: [
    `:host { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }

    button.btn-edit-ic,
    button.btn-action:not(.danger) {
      background: rgba(251, 146, 60, 0.15) !important;
      color: #ffffff !important;
      border-radius: 50% !important;
      padding: 7px !important;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    button.btn-del-ic,
    button.btn-action.danger {
      background: rgba(244, 63, 94, 0.15) !important;
      color: #ffffff !important;
      border-radius: 50% !important;
      padding: 7px !important;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    button.btn-edit-ic svg,
    button.btn-action:not(.danger) svg {
      stroke: #ffffff !important;
    }

    button.btn-del-ic svg,
    button.btn-action.danger svg {
      stroke: #ffffff !important;
    }`,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class LucideIconComponent implements OnChanges {
  @Input() name = '';
  @Input() size: number | string = 24;
  @ViewChild('svgEl', { static: true }) svgEl!: ElementRef<SVGElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name']) {
      this.renderIcon();
    }
  }

  private renderIcon(): void {
    const svg = this.svgEl?.nativeElement;
    if (!svg) return;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const nodes = ICON_MAP[this.name];
    if (!nodes) return;

    for (const [tag, attrs] of nodes) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, val] of Object.entries(attrs ?? {})) {
        if (key !== 'key') {
          el.setAttribute(key, val as string);
        }
      }
      svg.appendChild(el);
    }
  }
}
