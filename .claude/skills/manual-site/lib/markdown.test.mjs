import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderMarkdown} from './markdown.mjs';

test('명시한 빈 그림 앵커는 이동 가능한 요소로 렌더링한다',()=>{
  const html=renderMarkdown('<a id="save"></a>\n\n## 저장\n\n<a id="replay"></a>\n\n## 재전송');
  assert.match(html,/<a id="save" aria-hidden="true"><\/a>/);
  assert.match(html,/<a id="replay" aria-hidden="true"><\/a>/);
  assert.doesNotMatch(html,/&lt;a/);
});
test('스크립트·이벤트 속성·잘못된 ID는 앵커 허용으로 실행되지 않는다',()=>{
  for(const raw of ['<script>alert(1)</script>','<a id="save" onclick="alert(1)"></a>','<a id="x\" onmouseover=alert(1)"></a>']){
    const html=renderMarkdown(raw);assert.doesNotMatch(html,/<script|<a\s/);assert.match(html,/&lt;/);
  }
});
