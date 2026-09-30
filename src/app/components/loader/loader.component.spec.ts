import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoaderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    const fixture = TestBed.createComponent(LoaderComponent);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('is announced as a status with a default medium size', () => {
    const element = render();
    expect(element.getAttribute('role')).toBe('status');
    expect(element.classList).toContain('loader--medium');
    // No visible message: only the screen-reader label is rendered.
    expect(element.querySelector('.loader__message')).toBeNull();
    expect(element.querySelector('.visually-hidden')).not.toBeNull();
  });

  it('renders the message and applies size and overlay modifiers', () => {
    const element = render({ size: 'large', message: 'Loading leads', overlay: true });
    expect(element.querySelector('.loader__message')?.textContent?.trim()).toBe('Loading leads');
    expect(element.classList).toContain('loader--large');
    expect(element.classList).toContain('loader--overlay');
  });
});
