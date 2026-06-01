// chapter/section expand/collapse is handled natively by <details>/<summary>.

document.addEventListener('DOMContentLoaded', () => {
  const keyButtons = document.querySelectorAll('.book-key-btn');

  keyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const exercise = button.closest('.book-exercise');
      if (!exercise) return;

      const keyDiv = exercise.querySelector('.book-key');
      if (!keyDiv) return;

      const isHidden = keyDiv.style.display === 'none';

      if (isHidden) {
        keyDiv.style.display = 'block';
        button.textContent = 'Hide key';
      } else {
        keyDiv.style.display = 'none';
        button.textContent = 'Show key';
      }
    });
  });
});
