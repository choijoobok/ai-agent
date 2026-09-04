package com.aiagent.support.excel;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Consumer;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

/**
 * 서버가 만드는 엑셀 — ADR-0019 의 <b>세 번째 갈래</b>.
 *
 * <p>architecture.md §1 이 엑셀을 이 모듈의 책임으로 두었다. <b>여기 있는 것은 시트를 쓰는 도구
 * 하나뿐</b>이며 무엇을 쓸지는 도메인이 정한다 — support 가 업무 컬럼을 알면 그 순간
 * 기술 어댑터가 아니게 된다.
 *
 * <h2>{@code SXSSF} 다 — 행을 창으로 흘린다</h2>
 *
 * <p>이 갈래에만 스트리밍이 남는다(10 FILE-05 · ADR-0019). 프론트 생성은 전량을 메모리에
 * 올리므로 스트리밍이 성립하지 않고 그래서 상한이 필요했지만, 서버 생성은 <b>합본이라
 * 행이 곱으로</b> 늘 수 있다 — 주문 500건에 품목이 각 20개면 만 행이다.
 *
 * <h2><b>마스킹은 부르는 쪽이 한다</b></h2>
 *
 * <p>ADR-0019 가 짚은 구멍이다: 엑셀 생성은 <b>응답 직렬화가 아니므로</b> 27 §2 의 PII
 * 계층을 타지 않는다. 셀을 채우는 코드가 마스킹을 건너뛰면 <b>화면에서는 가려진 값이
 * 엑셀에서는 평문으로</b> 나간다. 이 클래스는 받은 값을 그대로 쓰므로, 가려야 하는 값을
 * 가려서 주는 것은 도메인의 일이다.
 */
public final class ExcelSheetWriter implements AutoCloseable {

    /**
     * 메모리에 두는 행 수 — 넘으면 임시 파일로 흘린다.
     *
     * <p>작게 잡으면 디스크 I/O 가 늘고 크게 잡으면 힙을 먹는다. 100 은 POI 의 기본값이며,
     * <b>합본의 한 주문이 대개 이 안에 든다</b>.
     */
    private static final int WINDOW = 100;

    private final SXSSFWorkbook workbook;
    private final CellStyle header;
    private final CellStyle date;

    public ExcelSheetWriter() {
        this.workbook = new SXSSFWorkbook(WINDOW);
        this.header = workbook.createCellStyle();
        Font bold = workbook.createFont();
        bold.setBold(true);
        this.header.setFont(bold);
        this.date = workbook.createCellStyle();
        this.date.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd"));
    }

    /**
     * 시트 하나를 쓴다 — 첫 줄이 헤더다.
     *
     * @param name 시트 이름. <b>31자에서 자른다</b> — 엑셀의 상한이며 넘기면 POI 가 던진다
     * @param headers 헤더 글자. <b>번역은 부르는 쪽이 한다</b>
     * @param rows 행마다 셀 값들. 길이가 헤더와 달라도 되며 <b>짧으면 그만큼만</b> 쓴다
     */
    public void sheet(String name, List<String> headers, List<List<Object>> rows) {
        Sheet sheet = workbook.createSheet(name.length() > 31 ? name.substring(0, 31) : name);

        Row first = sheet.createRow(0);
        for (int index = 0; index < headers.size(); index += 1) {
            Cell cell = first.createCell(index);
            cell.setCellValue(headers.get(index));
            cell.setCellStyle(header);
        }

        int at = 1;
        for (List<Object> values : rows) {
            Row row = sheet.createRow(at);
            for (int index = 0; index < values.size(); index += 1) {
                write(row.createCell(index), values.get(index));
            }
            at += 1;
        }
    }

    /** 완성된 바이트 — <b>한 번만 부른다</b>. */
    public byte[] bytes() {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * <b>임시 파일을 지운다.</b> {@code SXSSF} 는 창을 넘긴 행을 디스크에 두므로, 닫지
     * 않으면 그 파일이 <b>프로세스가 끝날 때까지</b> 남는다 — 자주 내려받는 화면에서
     * 그것은 디스크가 서서히 차는 고장이 되고, 원인이 이 코드라는 것은 드러나지 않는다.
     */
    @Override
    public void close() {
        workbook.dispose();
        try {
            workbook.close();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * 값 하나 — <b>모르는 타입은 글자로</b> 쓴다.
     *
     * <p>{@code null} 은 빈 칸이다. {@code String.valueOf(null)} 이 {@code "null"} 을
     * 만드는 것이 이 분기가 있는 이유이며, 그 넉 자는 <b>값이 있는 것처럼</b> 보인다.
     */
    private void write(Cell cell, Object value) {
        switch (value) {
            case null -> cell.setBlank();
            // BigDecimal 도 여기로 온다 — Number 다. 따로 두면 컴파일러가 도달 불가라 말한다.
            case Number number -> cell.setCellValue(number.doubleValue());
            case Boolean flag -> cell.setCellValue(Boolean.TRUE.equals(flag) ? "Y" : "N");
            case LocalDate day -> {
                cell.setCellValue(day);
                cell.setCellStyle(date);
            }
            default -> cell.setCellValue(String.valueOf(value));
        }
    }

    /** 도구를 열고 쓰고 닫는 한 줄 — 닫기를 잊는 자리를 없앤다(위). */
    public static byte[] build(Consumer<ExcelSheetWriter> body) {
        try (ExcelSheetWriter writer = new ExcelSheetWriter()) {
            body.accept(writer);
            return writer.bytes();
        }
    }
}
