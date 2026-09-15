package com.example.quizhub.integration;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import java.util.ArrayList;
import java.util.List;

public class SqlCaptureInspector implements StatementInspector {
    private static final List<String> capturedSql = new ArrayList<>();
    private static boolean capturing = false;

    @Override
    public String inspect(String sql) {
        if (capturing) {
            capturedSql.add(sql);
        }
        return sql;
    }

    public static void start() {
        capturedSql.clear();
        capturing = true;
    }

    public static List<String> stop() {
        capturing = false;
        return new ArrayList<>(capturedSql);
    }
}
