import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { IconComponent } from '../icon/icon.component';

/**
 * Reusable modal built on the native <dialog> (focus trap, Esc to close, backdrop for free).
 *
 * Usage:
 *   <app-modal [open]="isOpen()" title="EMAIL.COMPOSE_TITLE" (closed)="isOpen.set(false)">
 *     ...content...
 *     <div modal-footer>...buttons...</div>
 *   </app-modal>
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly open = input(false);
  /** Translation key (or plain text) for the header. */
  readonly title = input('');
  readonly size = input<'medium' | 'large'>('medium');
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  /** A click on the <dialog> element itself (not its content) is a click on the backdrop. */
  protected onClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }
}
